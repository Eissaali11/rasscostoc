/**
 * Compatibility re-export — Central Serial Engine lives in @core/serial.
 * Prefer importing from `@core/serial/serial-recognition.service` in new code.
 */
export {
  SerialRecognitionService,
  type RecognitionResult,
  type StoredSerialResolution,
} from "@core/serial/serial-recognition.service";
