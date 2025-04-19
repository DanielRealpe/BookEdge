import api from "./api";

export const getAllComfortsForBedRoom = async () => {
  const response = await api.get("/bedroom-comforts/all");
  return response.data;
};

export const getBedRoomsWithoutComforts = async () => {
  const response = await api.get("/bedroom-comforts/bedrooms-without-comforts");
  return response.data;
};

export const assignComfortsToBedRoom = async (data) => {
  const response = await api.post("/bedroom-comforts/assign", data);
  return response.data;
};

export const updateComfortsToBedRoom = async (data) => {
  const response = await api.put("/bedroom-comforts/update", data);
  return response.data;
};