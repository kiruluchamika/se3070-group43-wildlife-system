import React, { useState } from "react";
import { Image, View } from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Button, Card, ErrorMessage, Field, Label } from "./ui";
export type Point = { lat: number; lng: number; accuracyMeters?: number };
export function LocationInput({
  value,
  onChange,
}: {
  value?: Point;
  onChange: (v: Point | undefined) => void;
}) {
  const [lat, setLat] = useState(value ? String(value.lat) : ""),
    [lng, setLng] = useState(value ? String(value.lng) : ""),
    [error, setError] = useState<any>(),
    [busy, setBusy] = useState(false);
  async function gps() {
    setBusy(true);
    setError(undefined);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted")
        throw new Error(
          "Location permission denied. Enter coordinates or describe the location in the form.",
        );
      const p = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const point = {
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        ...(p.coords.accuracy != null
          ? { accuracyMeters: p.coords.accuracy }
          : {}),
      };
      setLat(String(point.lat));
      setLng(String(point.lng));
      onChange(point);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  function update(a: string, b: string) {
    setLat(a);
    setLng(b);
    if (
      a !== "" &&
      b !== "" &&
      Number.isFinite(Number(a)) &&
      Number.isFinite(Number(b)) &&
      Math.abs(Number(a)) <= 90 &&
      Math.abs(Number(b)) <= 180
    ) {
      onChange({ lat: Number(a), lng: Number(b) });
      setError(undefined);
    } else {
      onChange(undefined);
      if (a || b)
        setError(
          "Enter both latitude (-90 to 90) and longitude (-180 to 180), or leave both blank.",
        );
    }
  }
  return (
    <Card>
      <Label>Location (optional GPS, or enter manually)</Label>
      <Button
        title={busy ? "Locating…" : "Use current GPS"}
        disabled={busy}
        onPress={() => void gps()}
      />
      <Field
        label="Latitude"
        value={lat}
        onChange={(v) => update(v, lng)}
        keyboard="default"
      />
      <Field
        label="Longitude"
        value={lng}
        onChange={(v) => update(lat, v)}
        keyboard="default"
      />
      {value?.accuracyMeters != null && (
        <Label muted>Accuracy: {Math.round(value.accuracyMeters)} metres</Label>
      )}
      <ErrorMessage error={error} />
    </Card>
  );
}
export type Photo = { dataUrl: string; caption?: string };
export function PhotosInput({
  photos,
  onChange,
}: {
  photos: Photo[];
  onChange: (v: Photo[]) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<any>();
  async function add(camera: boolean) {
    if (photos.length >= 3) return;
    setBusy(true);
    setError(undefined);
    try {
      const p = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!p.granted)
        throw new Error(
          "Permission denied. You can submit without a photo or enable permission in device settings.",
        );
      const result = camera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            quality: 1,
          });
      if (result.canceled) return;
      const asset = result.assets[0];
      let encoded = "";
      for (const width of [1024, 768, 512, 320]) {
        const output = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: Math.min(width, asset.width) } }],
          {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          },
        );
        encoded = "data:image/jpeg;base64," + output.base64;
        if (encoded.length <= 300000) break;
      }
      if (encoded.length > 300000)
        throw new Error(
          "This image is too large after compression. Choose another photo.",
        );
      onChange([...photos, { dataUrl: encoded }]);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <Label>Evidence · {photos.length}/3 photos</Label>
      {photos.map((p, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Image
            accessibilityLabel={p.caption || `Evidence ${i + 1}`}
            source={{ uri: p.dataUrl }}
            style={{ height: 180, borderRadius: 12 }}
            resizeMode="contain"
          />
          <Field
            label="Caption"
            value={p.caption ?? ""}
            onChange={(v) =>
              onChange(
                photos.map((x, j) =>
                  j === i ? { ...x, caption: v.slice(0, 120) } : x,
                ),
              )
            }
          />
          <Button
            secondary
            title="Remove photo"
            onPress={() => onChange(photos.filter((_, j) => j !== i))}
          />
        </View>
      ))}
      <Button
        secondary
        title="Take photo"
        disabled={busy || photos.length >= 3}
        onPress={() => void add(true)}
      />
      <Button
        secondary
        title="Choose photo"
        disabled={busy || photos.length >= 3}
        onPress={() => void add(false)}
      />
      <ErrorMessage error={error} />
    </Card>
  );
}
