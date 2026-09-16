import { useEffect } from 'react';
import { installServerCancelBridge } from './TaskServerCancelBridge.js';

export default function TaskServerCancelBridge() {
  useEffect(() => installServerCancelBridge(), []);
  return null;
}
