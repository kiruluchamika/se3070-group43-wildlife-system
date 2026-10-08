import React from "react";
import { Redirect } from "expo-router";
import { useSession } from "../src/contexts/Session";
import { Loading } from "../src/components/ui";
export default function Index() {
  const { loading, user } = useSession();
  return loading ? (
    <Loading />
  ) : (
    <Redirect href={user ? "/(protected)/(tabs)" : "/login"} />
  );
}
