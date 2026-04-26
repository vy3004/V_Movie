import { Receiver } from "@upstash/qstash";

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

if (!currentSigningKey || !nextSigningKey) {
  throw new Error(
    "Thiếu biến môi trường QSTASH_CURRENT_SIGNING_KEY hoặc QSTASH_NEXT_SIGNING_KEY",
  );
}

export const qstashReceiver = new Receiver({
  currentSigningKey,
  nextSigningKey,
});
