import { useEffect } from 'react';
import { installServerCancelBridge } from './TaskServerCancelBridge';

export default function TaskServerCancelBridge() {
  useEffect(() => installServerCancelBridge(), []);
  return null;
}
