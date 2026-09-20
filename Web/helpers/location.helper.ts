import axios from "axios";
import { getApiShipping } from "../configs/setting.config";
import { metadataCache } from "./metadata-cache.helper";

interface GoShipLocation {
  id: string;
  name: string;
}

const normalizeAddress = async (city: string, district: string, ward: string) => {
  const normKey = `goship:norm:${city.toLowerCase()}:${district.toLowerCase()}:${ward.toLowerCase()}`;
  const cachedNorm = metadataCache.get<{ city: string; district: string; ward: string }>(normKey);
  if (cachedNorm) return cachedNorm;

  const apiShipping = await getApiShipping();
  const goshipBase = String(apiShipping.goshipApiUrl || "https://sandbox.goship.io/api/v2");
  const authHeaders = {
    Authorization: `Bearer ${apiShipping.tokenGoShip}`
  };

  let cityList = metadataCache.get<GoShipLocation[]>("goship:cities");
  if (!cityList) {
    const cityRes = await axios.get(`${goshipBase}/cities`, { headers: authHeaders });
    cityList = cityRes.data?.data || [];
    if (cityList && cityList.length > 0) {
      metadataCache.set("goship:cities", cityList, 86400);
    }
  }

  const cityInfo: GoShipLocation | undefined = cityList?.find((item: GoShipLocation) =>
    item.name.toLowerCase().includes(city.toLowerCase()) || city.toLowerCase().includes(item.name.toLowerCase())
  );

  let districtInfo: GoShipLocation | undefined;
  if (cityInfo) {
    const distKey = `goship:districts:${cityInfo.id}`;
    let districtList = metadataCache.get<GoShipLocation[]>(distKey);
    if (!districtList) {
      const districtRes = await axios.get(`${goshipBase}/cities/${cityInfo.id}/districts`, { headers: authHeaders });
      districtList = districtRes.data?.data || [];
      if (districtList && districtList.length > 0) {
        metadataCache.set(distKey, districtList, 86400);
      }
    }
    districtInfo = districtList?.find((item: GoShipLocation) =>
      item.name.toLowerCase().includes(district.toLowerCase()) || district.toLowerCase().includes(item.name.toLowerCase())
    );
  }

  let wardInfo: GoShipLocation | undefined;
  if (districtInfo) {
    const wardKey = `goship:wards:${districtInfo.id}`;
    let wardList = metadataCache.get<GoShipLocation[]>(wardKey);
    if (!wardList) {
      const wardRes = await axios.get(`${goshipBase}/districts/${districtInfo.id}/wards`, { headers: authHeaders });
      wardList = wardRes.data?.data || [];
      if (wardList && wardList.length > 0) {
        metadataCache.set(wardKey, wardList, 86400);
      }
    }
    wardInfo = wardList?.find((item: GoShipLocation) =>
      item.name.toLowerCase().includes(ward.toLowerCase()) || ward.toLowerCase().includes(item.name.toLowerCase())
    );
  }

  const dataFinal = {
    city: cityInfo?.id || "",
    district: districtInfo?.id || "",
    ward: wardInfo?.id || ""
  };

  if (dataFinal.city && dataFinal.district && dataFinal.ward) {
    metadataCache.set(normKey, dataFinal, 86400);
  }
  return dataFinal;
};

export const getInfoAddress = async (latitude: number, longitude: number) => {
  const geoKey = `geo:${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`;
  const cachedGeo = metadataCache.get<{ city: string; district: string; ward: string }>(geoKey);
  if (cachedGeo) return cachedGeo;

  const geoRes = await axios.get("https://mapapis.openmap.vn/v1/geocode/reverse", {
    params: { latlng: `${Number(latitude)},${Number(longitude)}`, apikey: process.env.OPENMAP_API_KEY }
  });

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
  if (result.city && result.district && result.ward) {
    metadataCache.set(geoKey, result, 86400);
  }
  return result;
};
