import axios from "axios";
import { getApiShipping } from "../configs/setting.config";

interface GoShipLocation {
  id: string;
  name: string;
}

const normalizeAddress = async (city: string, district: string, ward: string) => {
  const apiShipping = await getApiShipping();

  const goshipBase = String(apiShipping.goshipApiUrl || "https://sandbox.goship.io/api/v2");
  const cityRes = await axios.get(`${goshipBase}/cities`, {
    headers: {
      Authorization: `Bearer ${apiShipping.tokenGoShip}`
    }
  });
  const cityInfo: GoShipLocation | undefined = cityRes.data.data.find((item: GoShipLocation) =>
    item.name.toLowerCase().includes(city.toLowerCase()) || city.toLowerCase().includes(item.name.toLowerCase())
  );

  let districtInfo: GoShipLocation | undefined;
  if (cityInfo) {
    const districtRes = await axios.get(`${goshipBase}/cities/${cityInfo.id}/districts`, {
      headers: {
        Authorization: `Bearer ${apiShipping.tokenGoShip}`
      }
    });
    districtInfo = districtRes.data.data.find((item: GoShipLocation) =>
      item.name.toLowerCase().includes(district.toLowerCase()) || district.toLowerCase().includes(item.name.toLowerCase())
    );
  }

  let wardInfo: GoShipLocation | undefined;
  if (districtInfo) {
    const wardRes = await axios.get(`${goshipBase}/districts/${districtInfo.id}/wards`, {
      headers: {
        Authorization: `Bearer ${apiShipping.tokenGoShip}`
      }
    });
    wardInfo = wardRes.data.data.find((item: GoShipLocation) =>
      item.name.toLowerCase().includes(ward.toLowerCase()) || ward.toLowerCase().includes(item.name.toLowerCase())
    );
  }

  const dataFinal = {
    city: cityInfo?.id || "",
    district: districtInfo?.id || "",
    ward: wardInfo?.id || ""
  };

  return dataFinal;
};

export const getInfoAddress = async (latitude: number, longitude: number) => {
  const geoRes = await axios.get(`https://mapapis.openmap.vn/v1/geocode/reverse?latlng=${latitude},${longitude}&apikey=${process.env.OPENMAP_API_KEY}`);

  let city = "";
  let district = "";
  let ward = "";

  const addressArray: Array<{ long_name: string; short_name: string }> = geoRes.data.results?.[0]?.address_components || [];
  const cityComponents: string[] = [];

  for (const item of addressArray) {
    const name = item.long_name.toLowerCase();

    if (name.includes("phường") || name.includes("xã") || name.includes("thị trấn")) {
      ward = item.short_name;
    } else if (name.includes("quận") || name.includes("huyện") || name.includes("thị xã")) {
      district = item.short_name;
    } else if (name.includes("thành phố") || name.includes("tỉnh")) {
      cityComponents.push(item.short_name);
    }
  }

  if (cityComponents.length >= 2) {
    district = cityComponents[cityComponents.length - 2];
    city = cityComponents[cityComponents.length - 1];
  } else if (cityComponents.length === 1) {
    city = cityComponents[0];
  }

  const result = await normalizeAddress(city, district, ward);

  return result;
};
