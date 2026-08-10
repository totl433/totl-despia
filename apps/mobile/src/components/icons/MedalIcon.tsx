import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = {
  size?: number;
  color?: string;
};

export default function MedalIcon({ size = 16, color = '#1C8376' }: Props) {
  return <Ionicons name="medal" size={size} color={color} />;
}
