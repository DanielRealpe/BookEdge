import api from "./api";

const API_URL_RESERVATIONS = "/reservations";
const API_URL_PLANS = "/plan";

const validateId = (id, name = "ID") => {
  const numId = Number(id);
  if (isNaN(numId) || numId <= 0) {
    throw new Error(`${name} inválido: debe ser un número positivo`);
  }
  return numId;
};

export const getReservation = async () => {
  try {
    const { data } = await api.get(API_URL_RESERVATIONS);
    return data;
  } catch (error) {
    console.error("❌ Error al obtener reservas:", {
      message: error.message,
      response: error.response?.data,
    });
    throw new Error(`Error al obtener reservas: ${error.message}`);
  }
};

export const getReservationById = async (idReservation) => {
  try {
    const id = validateId(idReservation, "ID de reserva");
    const { data } = await api.get(`${API_URL_RESERVATIONS}/${id}`);
    return data;
  } catch (error) {
    console.error(`❌ Error al obtener reserva con ID ${idReservation}:`, {
      message: error.message,
      response: error.response?.data,
    });
    throw new Error(`Error al obtener reserva: ${error.message}`);
  }
};

export const getReservationsByUser = async (idUser) => {
  try {
    const id = validateId(idUser, "ID de usuario");
    const { data } = await api.get(`${API_URL_RESERVATIONS}/user/${id}`);
    return data;
  } catch (error) {
    console.error(
      `❌ Error al obtener reservas para el usuario con ID ${idUser}:`,
      {
        message: error.message,
        response: error.response?.data,
      }
    );
    throw new Error(`Error al obtener reservas: ${error.message}`);
  }
};

export const getUsers = async () => {
  const response = await api.get("/user");
  return response.data;
};

export const getServices = async () => {
  const response = await api.get("/services");
  return response.data;
};

export const getBedrooms = async () => {
  const response = await api.get("/bedroom");
  return response.data;
};

export const getAllPlanes = async () => {
  try {
    const { data } = await api.get(API_URL_PLANS);
    return data;
  } catch (error) {
    console.error("❌ Error al obtener planes:", {
      message: error.message,
      response: error.response?.data,
      config: error.config,
    });
    return [];
  }
};

export const getCabins = async () => {
  try {
    const { data } = await api.get(`${API_URL_RESERVATIONS}/cabins`);
    const normalizedCabins = data.map((cabin) => ({
      idCabin: cabin.idCabin,
      name: cabin.name || `Cabaña ${cabin.idCabin}`,
      capacity: Number(cabin.capacity) || 0,
      status: (cabin.status || "En Servicio").trim(),
      description: cabin.description || "Sin descripción",
      price: Number(cabin.price) || 0,
    }));
    return normalizedCabins;
  } catch (error) {
    console.error("❌ Error al obtener cabañas:", {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
    });
    return [];
  }
};

const validateReservationData = (reservationData, selectedPlan) => {
  if (!reservationData) {
    throw new Error("No se proporcionaron datos de reserva");
  }

  const errors = {
    missingFields: [],
    typeErrors: [],
    businessErrors: [],
  };

  const requiredFields = {
    idUser: "number",
    idPlan: "number",
    startDate: "string",
    status: "string",
  };

  Object.entries(requiredFields).forEach(([field, type]) => {
    if (
      reservationData[field] === undefined ||
      reservationData[field] === null ||
      reservationData[field] === ""
    ) {
      errors.missingFields.push(field);
    } else {
      const actualType = typeof reservationData[field];
      if (actualType !== type) {
        if (type === "number" && !isNaN(Number(reservationData[field]))) {
          console.log(
            `Convirtiendo ${field} a número: ${reservationData[field]}`
          );
        } else {
          errors.typeErrors.push(
            `${field} debe ser ${type}, pero es ${actualType}`
          );
        }
      }
    }
  });

  if (planHasAccommodation(selectedPlan)) {
    if (!reservationData.endDate) {
      errors.missingFields.push("endDate");
    }
  }

  if (reservationData.startDate) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (reservationData.startDate < todayStr) {
      errors.businessErrors.push(
        "La fecha de inicio no puede ser en el pasado"
      );
    }
    console.log("DEBUG FECHAS:", {
      startRaw: reservationData.startDate,
      todayStr,
    });
  }

  if (
    planHasAccommodation(selectedPlan) &&
    reservationData.startDate &&
    reservationData.endDate &&
    reservationData.startDate > reservationData.endDate
  ) {
    errors.businessErrors.push(
      "La fecha de fin debe ser posterior a la de inicio"
    );
  }

  const validStatuses = ["Confirmado", "Pendiente", "Anulado", "Reservado"];
  if (
    reservationData.status &&
    !validStatuses.includes(reservationData.status)
  ) {
    errors.businessErrors.push(
      `Estado no válido. Use uno de: ${validStatuses.join(", ")}`
    );
  }

  return errors;
};

const prepareReservationPayload = (reservationData, selectedPlan) => {
  const payload = {
    idUser: Number(reservationData.idUser),
    idPlan: Number(reservationData.idPlan),
    idCabin: reservationData.idCabin ? Number(reservationData.idCabin) : null,
    idRoom: reservationData.idRoom ? Number(reservationData.idRoom) : null,
    startDate: reservationData.startDate,
    endDate: reservationData.endDate,
    status: reservationData.status || "Reservado",
    total: Number(reservationData.total) || 0,
    companionCount: Array.isArray(reservationData.companions)
      ? reservationData.companions.length
      : 0,
    companions: Array.isArray(reservationData.companions)
      ? reservationData.companions
      : [],
    paymentMethod: reservationData.paymentMethod || "Efectivo",
    services: Array.isArray(reservationData.services)
      ? reservationData.services
      : [],
  };

  if (!planHasAccommodation(selectedPlan)) {
    delete payload.endDate;
  }

  return payload;
};

export const createReservation = async (reservationData) => {
  try {
    const planes = await getAllPlanes();
    const selectedPlan = planes.find(
      (p) => p.idPlan === Number(reservationData.idPlan)
    );
    const errors = validateReservationData(reservationData, selectedPlan);

    if (
      errors.missingFields.length > 0 ||
      errors.typeErrors.length > 0 ||
      errors.businessErrors.length > 0
    ) {
      const errorMessages = [
        errors.missingFields.length > 0
          ? `Campos requeridos: ${errors.missingFields.join(", ")}`
          : "",
        errors.typeErrors.length > 0
          ? `Errores de tipo: ${errors.typeErrors.join(", ")}`
          : "",
        errors.businessErrors.length > 0
          ? `Errores de negocio: ${errors.businessErrors.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" | ");

      throw new Error(errorMessages);
    }

    if (reservationData.idRoom) {
      const disponible = await isBedroomAvailable(
        reservationData.idRoom,
        reservationData.startDate,
        reservationData.endDate
      );
      if (!disponible) {
        throw new Error("La habitación ya está reservada para esas fechas.");
      }
    }

    const payload = prepareReservationPayload(reservationData, selectedPlan);
    console.log("Payload enviado al backend:", payload);
    const response = await api.post(API_URL_RESERVATIONS, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      }
    });

    return response.data;
  } catch (error) {
    console.error("❌ Error en createReservation:", {
      message: error.message,
      response: error.response?.data,
      request: error.config?.data,
    });

    let errorMessage = error.message;
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.errors) {
      errorMessage = error.response.data.errors.map((e) => e.msg).join("\n");
    }

    throw new Error(errorMessage);
  }
};

export const updateReservation = async (idReservation, reservationData) => {
  try {
    const reservationId = Number(idReservation);
    if (
      isNaN(reservationId) ||
      !Number.isInteger(reservationId) ||
      reservationId <= 0
    ) {
      throw new Error("El ID de la reserva debe ser un número entero positivo");
    }

    const planes = await getAllPlanes();
    const selectedPlan = planes.find(
      (p) => p.idPlan === Number(reservationData.idPlan)
    );
    const errors = validateReservationData(reservationData, selectedPlan);

    if (
      errors.missingFields.length > 0 ||
      errors.typeErrors.length > 0 ||
      errors.businessErrors.length > 0
    ) {
      const errorMessages = [
        errors.missingFields.length > 0
          ? `Campos requeridos: ${errors.missingFields.join(", ")}`
          : "",
        errors.typeErrors.length > 0
          ? `Errores de tipo: ${errors.typeErrors.join(", ")}`
          : "",
        errors.businessErrors.length > 0
          ? `Errores de negocio: ${errors.businessErrors.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" | ");

      throw new Error(errorMessages);
    }

    try {
      const { data } = await api.get(
        `${API_URL_RESERVATIONS}/${reservationId}`
      );
      if (!data || !data.idReservation) {
        throw new Error(`La reserva con ID ${reservationId} no existe`);
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error(`La reserva con ID ${reservationId} no existe`);
      }
      throw error;
    }

    const payload = {
      ...prepareReservationPayload(reservationData, selectedPlan),
      idReservation: reservationId,
    };

    console.log("Payload enviado al backend (update):", payload);
    const response = await api.put(
      `${API_URL_RESERVATIONS}/${reservationId}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    console.error("❌ Error detallado en updateReservation:", {
      message: error.message,
      response: error.response?.data,
      request: error.config?.data,
    });

    let errorMessage = "Error al actualizar la reserva";
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.errors) {
      errorMessage = error.response.data.errors.map((e) => e.msg).join(", ");
    } else {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

export const changeReservationStatus = async (idReservation, status) => {
  try {
    const id = validateId(idReservation, "ID de reserva");
    const validStatuses = ["Confirmado", "Pendiente", "Anulado", "Reservado"];
    if (!validStatuses.includes(status)) {
      throw new Error(
        `Estado no válido. Use uno de: ${validStatuses.join(", ")}`
      );
    }

    const currentReservation = await getReservationById(id);

    if (!currentReservation) {
      throw new Error(`No se encontró la reserva con ID ${id}`);
    }

    const payload = {
      idUser: currentReservation.idUser,
      idPlan: currentReservation.idPlan,
      idCabin: currentReservation.idCabin,
      idRoom: currentReservation.idRoom || null,
      startDate: currentReservation.startDate,
      endDate: currentReservation.endDate,
      status: status,
      total: currentReservation.total || 0,
      companionCount: Array.isArray(currentReservation.companions)
        ? currentReservation.companions.length
        : 0,
      companions: Array.isArray(currentReservation.companions)
        ? currentReservation.companions
        : [],
      paymentMethod: currentReservation.paymentMethod || "Efectivo",
      services: Array.isArray(currentReservation.services)
        ? currentReservation.services
        : [],
      idReservation: id,
    };

    const response = await api.patch(
      `${API_URL_RESERVATIONS}/${id}/status`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    console.error(`❌ Error cambiando estado de reserva ${idReservation}:`, {
      message: error.message,
      response: error.response?.data,
      config: error.config,
    });
    throw new Error(`Error al cambiar estado: ${error.message}`);
  }
};

export const getReservationCompanions = async (reservationId) => {
  try {
    const id = validateId(reservationId, "ID de reserva");
    const { data } = await api.get(`${API_URL_RESERVATIONS}/${id}/companions`);
    return data;
  } catch (error) {
    console.error(
      `❌ Error al obtener acompañantes de reserva con ID ${reservationId}:`,
      {
        message: error.message,
        response: error.response?.data,
      }
    );
    return [];
  }
};

export const addCompanionReservation = async (reservationId, companionData) => {
  try {
    const id = validateId(reservationId, "ID de reserva");

    if (!companionData?.idCompanions) {
      throw new Error("Falta el ID del acompañante");
    }

    const payload = {
      idCompanions: Number(companionData.idCompanions),
    };

    const response = await api.post(
      `${API_URL_RESERVATIONS}/${id}/companions`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("❌ Error detallado en asociación:", {
      url: error.config?.url,
      data: error.config?.data,
      status: error.response?.status,
      response: error.response?.data,
    });

    const errorMessage = error.response?.data?.message || error.message;
    throw new Error(`Error al asociar acompañante: ${errorMessage}`);
  }
};

export const associateCompanionToReservation = async (
  reservationId,
  companionId
) => {
  try {
    const response = await api.post(
      `/reservations/${reservationId}/companions`,
      { idCompanions: companionId },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error en associateCompanionToReservation:", {
      reservationId,
      companionId,
      error: error.response?.data || error.message,
    });
    throw error;
  }
};

export const deleteCompanionReservation = async (
  reservationId,
  companionId
) => {
  try {
    const resId = validateId(reservationId, "ID de reserva");
    const compId = validateId(companionId, "ID de acompañante");

    const { data } = await api.delete(
      `${API_URL_RESERVATIONS}/${resId}/companions/${compId}`
    );
    return data;
  } catch (error) {
    console.error(
      `❌ Error al eliminar acompañante ${companionId} de reserva ${reservationId}:`,
      {
        message: error.message,
        response: error.response?.data,
      }
    );
    throw new Error(`Error al eliminar acompañante: ${error.message}`);
  }
};

export const getReservationPayments = async (reservationId) => {
  try {
    const id = validateId(reservationId, "ID de reserva");
    const { data } = await api.get(`${API_URL_RESERVATIONS}/${id}/payments`);
    if (!Array.isArray(data)) {
      return [];
    }
    return data;
  } catch (error) {
    console.error(
      `❌ Error al obtener pagos de reserva con ID ${reservationId}:`,
      {
        message: error.message,
        response: error.response?.data,
      }
    );
    return [];
  }
};

const isDateRangeOverlap = (startA, endA, startB, endB) => {
  return (
    new Date(startA) <= new Date(endB) && new Date(endA) >= new Date(startB)
  );
};

export const isBedroomAvailable = async (idRoom, startDate, endDate) => {
  const allReservations = await getReservation();
  return !allReservations.some(
    (res) =>
      res.idRoom === idRoom &&
      isDateRangeOverlap(startDate, endDate, res.startDate, res.endDate)
  );
};

const planHasAccommodation = (plan) => {
  return (
    (Array.isArray(plan?.bedroomDistribution) &&
      plan.bedroomDistribution.length > 0) ||
    (Array.isArray(plan?.cabinDistribution) &&
      plan.cabinDistribution.length > 0)
  );
};
