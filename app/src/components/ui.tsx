import React, { createContext, useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export const colors = {
  bg: "#061419",
  surface: "#0b1f26",
  raised: "#14343f",
  line: "#28474f",
  text: "#e7f5f2",
  muted: "#9dbac0",
  brand: "#24d6c2",
  danger: "#fca5a5",
};
export const human = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
export function Label({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Text
      style={{
        color: muted ? colors.muted : colors.text,
        fontSize: 15,
        lineHeight: 23,
      }}
    >
      {children}
    </Text>
  );
}
export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.text,
        fontSize: 24,
        fontWeight: "800",
        marginBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: secondary ? colors.raised : colors.brand,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text
        style={{
          color: secondary ? colors.text : colors.bg,
          fontSize: 15,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
export function Disclosure({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Button
        secondary
        title={`${open ? "▾" : "▸"} ${title}`}
        onPress={() => setOpen(!open)}
      />
      {open && children}
    </View>
  );
}
const PageContext = createContext(false);
export function Badge({ value }: { value: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors.raised,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 5,
      }}
    >
      <Text style={{ color: colors.brand, fontSize: 13, fontWeight: "700" }}>
        {human(value)}
      </Text>
    </View>
  );
}
export function Field({
  label,
  value,
  onChange,
  secure = false,
  multiline = false,
  keyboard = "default",
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  secure?: boolean;
  multiline?: boolean;
  keyboard?: "default" | "email-address" | "decimal-pad" | "phone-pad";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        multiline={multiline}
        keyboardType={keyboard}
        autoCapitalize="none"
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}
export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  return (
    <View style={{ gap: 6 }}>
      <Label>{label}</Label>
      <Button
        secondary
        title={
          (options.find((o) => o.value === value)?.label ?? "Choose…") + " ▾"
        }
        onPress={() => setOpen(!open)}
      />
      {open && (
        <Card>
          {options.length > 8 && (
            <Field label="Search options" value={search} onChange={setSearch} />
          )}
          {options
            .filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
            .map((o) => (
              <Button
                key={o.value}
                secondary={value !== o.value}
                title={o.label}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              />
            ))}
          {!options.length && <Label>No options available.</Label>}
        </Card>
      )}
    </View>
  );
}
export const options = (items: string[]) =>
  items.map((value) => ({ value, label: human(value) }));
export function ErrorMessage({ error }: { error: any }) {
  return error ? (
    <View
      accessibilityRole="alert"
      style={{ padding: 12, borderRadius: 12, backgroundColor: "#3b222c" }}
    >
      <Text style={{ color: colors.danger }}>
        {typeof error === "string" ? error : error.message}
      </Text>
      {Array.isArray(error.details) &&
        error.details.map((d: any, i: number) => (
          <Text key={i} style={{ color: colors.danger }}>
            {d.field}: {d.message}
          </Text>
        ))}
    </View>
  ) : null;
}
export function Page({
  title,
  children,
  refresh,
  refreshing = false,
}: {
  title: string;
  children: React.ReactNode;
  refresh?: () => void;
  refreshing?: boolean;
}) {
  const nested = useContext(PageContext);
  if (nested)
    return (
      <View style={{ gap: 16 }}>
        <Title>{title}</Title>
        {children}
      </View>
    );
  return (
    <PageContext.Provider value={true}>
      <SafeAreaView
        edges={["left", "right", "bottom"]}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 40 }}
            refreshControl={
              refresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refresh}
                  tintColor={colors.brand}
                />
              ) : undefined
            }
          >
            <Title>{title}</Title>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </PageContext.Provider>
  );
}
export function Loading() {
  return (
    <Card>
      <ActivityIndicator color={colors.brand} />
      <Label muted>Loading WildGuard records…</Label>
      <View
        style={{ height: 18, backgroundColor: colors.raised, borderRadius: 6 }}
      />
      <View
        style={{
          height: 18,
          width: "65%",
          backgroundColor: colors.raised,
          borderRadius: 6,
        }}
      />
    </Card>
  );
}
export function QueryState({
  query,
  children,
}: {
  query: any;
  children: (data: any) => React.ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <>
        <ErrorMessage error={query.error} />
        <Button title="Retry" onPress={() => query.refetch()} />
      </>
    );
  return (
    <>
      {query.data?.offlineCache && (
        <Label muted>
          Saved field data. Refresh when connected before making operational
          decisions.
        </Label>
      )}
      {children(query.data)}
    </>
  );
}
export function Detail({ data }: { data: any }) {
  if (data == null) return <Label muted>Not recorded</Label>;
  if (typeof data !== "object")
    return (
      <Label>
        {typeof data === "boolean" ? (data ? "Yes" : "No") : String(data)}
      </Label>
    );
  return (
    <View style={{ gap: 9 }}>
      {Object.entries(data)
        .filter(
          ([key]) =>
            !["dataUrl", "password", "token", "passwordHash", "__v"].includes(
              key,
            ),
        )
        .map(([key, value]) => (
          <View key={key} style={{ gap: 3 }}>
            <Text
              style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}
            >
              {human(key)}
            </Text>
            {typeof value === "object" && value !== null ? (
              <View
                style={{
                  borderLeftWidth: 1,
                  borderColor: colors.line,
                  paddingLeft: 10,
                }}
              >
                <Detail data={value} />
              </View>
            ) : (
              <Detail data={value} />
            )}
          </View>
        ))}
    </View>
  );
}
export function confirm(title: string, message: string) {
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Confirm", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}
const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 12,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    padding: 12,
    justifyContent: "center",
  },
  input: {
    color: colors.text,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    minHeight: 48,
    padding: 12,
    fontSize: 16,
  },
});
