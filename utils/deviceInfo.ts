import DeviceInfo from "react-native-device-info";

const getDeviceName = async () => {
  var name = "";

  try {
    name = await DeviceInfo.getDeviceName();
  } catch (error) {
    console.error("Error getting device name:", error);
  }

  if (name !== "") {
    return name;
  } else {
    return null;
  }
};

export default getDeviceName;
