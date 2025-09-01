import { Stack } from "expo-router";

export default function ProfileStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileWelcome" />
      <Stack.Screen name="LabInterests" />
      <Stack.Screen name="CustomizeInterests" />
    </Stack>
  );
}
