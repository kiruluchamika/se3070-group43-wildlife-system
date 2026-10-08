import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Button, Disclosure, Field, Label } from './ui';

export function DateInput({ label, value, onChange, dateOnly = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  dateOnly?: boolean;
}) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  const parsed = new Date(dateOnly ? value + 'T12:00:00' : value);
  const current = Number.isFinite(parsed.getTime()) ? parsed : new Date();
  return (
    <View style={{ gap: 8 }}>
      <Label>{label}</Label>
      <Label muted>{value ? (dateOnly ? value : current.toLocaleString()) : 'Not set'}</Label>
      <Button secondary title="Choose date" onPress={() => setMode(mode === 'date' ? null : 'date')} />
      {!dateOnly && <Button secondary title="Choose time" onPress={() => setMode(mode === 'time' ? null : 'time')} />}
      {mode && <>
        <DateTimePicker
          value={current}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          themeVariant="dark"
          onChange={(event, date) => {
            if (Platform.OS === 'android') setMode(null);
            if (event.type === 'set' && date) {
              onChange(dateOnly
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                : date.toISOString());
            }
          }}
        />
        {Platform.OS === 'ios' && <Button secondary title="Done" onPress={() => setMode(null)} />}
      </>}
      <Label muted>{dateOnly ? 'Calendar dates use Asia/Colombo.' : 'Shown in device local time; submitted with an explicit timezone.'}</Label>
      <Disclosure title="Enter or clear date manually">
        <Field label={dateOnly ? 'YYYY-MM-DD' : 'ISO timestamp with timezone'} value={value} onChange={onChange} />
      </Disclosure>
    </View>
  );
}
