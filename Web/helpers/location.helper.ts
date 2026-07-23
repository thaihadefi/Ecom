import axios from "axios";
import { getApiShipping } from "../configs/setting.config";

const normalizeAddress = async (city: string, district: string, ward: string) => {
  const apiShipping = await getApiShipping();
  
  // Province/City information
  const goshipBase = process.env.GOSHIP_API_URL || "https://sandbox.goship.io/api/v2";
  const cityRes = await axios.get(`${goshipBase}/cities`, {
    headers: {
      Authorization: `Bearer ${apiShipping.tokenGoShip}`
    }
  });
  const cityInfo = cityRes.data.data.find((item: any) => item.name == city);

  // District information
  const districtRes = await axios.get(`${goshipBase}/cities/${cityInfo.id}/districts`, {
    headers: {
      Authorization: `Bearer ${apiShipping.tokenGoShip}`
    }
  });

  const districtInfo = districtRes.data.data.find((item: any) => item.name.includes(district));

  // Ward information
  const wardRes = await axios.get(`${goshipBase}/districts/${districtInfo.id}/wards`, {
    headers: {
      Authorization: `Bearer ${apiShipping.tokenGoShip}`
    }
  });

  const wardInfo = wardRes.data.data.find((item: any) => item.name.includes(ward));

  const dataFinal = {
    city: cityInfo.id,
    district: districtInfo.id,
    ward: wardInfo.id
  };

  return dataFinal;
}

export const getInfoAddress = async (latitude: number, longitude: number) => {
  const geoRes = await axios.get(`https://mapapis.openmap.vn/v1/geocode/reverse?latlng=${latitude},${longitude}&apikey=${process.env.OPENMAP_API_KEY}`);

  let city = "";
  let district = "";
  let ward = "";

  const addressArray = geoRes.data.results[0].address_components;
  
  for (const item of addressArray) {
    const name = item.long_name.toLowerCase();

    // Check Vietnamese province/city keywords
    if (name.includes("thành phố") || name.includes("tỉnh")) {
      city = item.short_name;
    }

    // Check Vietnamese district keywords
    if (name.includes("quận") || name.includes("huyện") || name.includes("thị xã")) {
      district = item.short_name;
    }
    
    // Check Vietnamese ward keywords
    if (name.includes("phường") || name.includes("xã")) {
      ward = item.short_name;
    }
  }

  const result = await normalizeAddress(city, district, ward);

  return result;
}