import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Label, colors } from "./ui";
/** The website's shield-and-leaf mark, rendered with native SVG. */
export function Logo() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View
        style={{ backgroundColor: colors.brand, borderRadius: 14, padding: 10 }}
      >
        <Svg
          width={30}
          height={30}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.bg}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M12 2.5 4.5 5.5v6c0 4.8 3.2 8.6 7.5 10 4.3-1.4 7.5-5.2 7.5-10v-6z" />
          <Path d="M8.5 14.5c0-3.5 2.6-6 7-6.2-.2 4.4-2.7 7-6.2 7M8.5 15.5 12 12" />
        </Svg>
      </View>
      <View>
        <Label>WILDGUARD</Label>
        <Label muted>Smart Wildlife Conservation</Label>
      </View>
    </View>
  );
}
