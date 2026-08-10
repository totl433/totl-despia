import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = {
  size?: number;
  color?: string;
};

export default function UnicornIcon({ size = 16, color = '#1C8376' }: Props) {
  return <Ionicons name="sparkles" size={size} color={color} />;
}
