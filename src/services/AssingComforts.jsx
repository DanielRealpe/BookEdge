import api from "./api";

// Obtener cabañas sin comodidades asignadas
export const getAllComfortsForCabins = async () => {
    const response = await api.get("/cabin-comforts/all");
    return response.data;
  };
export const getCabinsWithoutComforts = async () => {
  const response = await api.get("/cabin-comforts/cabins-without-comforts");
  return response.data;
};


// Asignar comodidades a una cabaña
export const assignComfortsToCabin = async (data) => {
  const response = await api.post("/cabin-comforts/assign", data);
  return response.data;
};

export const updateComfortsToCabin = async (data,id) => {
  const response = await api.put("/cabin-comforts/update", data,id);
  return response.data;
};