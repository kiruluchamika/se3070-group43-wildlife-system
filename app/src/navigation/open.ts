import { router } from "expo-router";
export const openWork = (path: string) =>
  router.push({
    pathname: "/(protected)/work/[...path]",
    params: { path: path.split("/") },
  });
