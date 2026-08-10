import React from 'react';
import { Text } from 'react-native';

type Props = {
  size?: number;
  children: string;
};

export default function EmojiText({ size = 16, children }: Props) {
  return <Text style={{ fontSize: size, lineHeight: size * 1.3 }}>{children}</Text>;
}
