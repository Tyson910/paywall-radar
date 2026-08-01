import { Secp256k1Keypair } from "@atproto/crypto";
import { type LexValue, encode } from "@atproto/lex-cbor";

export interface UnsignedLabel {
  src: string;
  uri: string;
  val: string;
  neg?: boolean;
  cts: string;
  cid?: string;
  exp?: string;
}

export interface SignedLabel {
  ver: 1;
  src: string;
  uri: string;
  val: string;
  neg?: boolean;
  cts: string;
  cid?: string;
  exp?: string;
  sig: Uint8Array;
}

export interface LabelSigner {
  sign(bytes: Uint8Array): Promise<Uint8Array>;
}

export async function loadSigningKey(key: string): Promise<Secp256k1Keypair> {
  return Secp256k1Keypair.import(key, { exportable: false });
}

function excludeNullish(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value != null) result[key] = value;
  }
  return result;
}

export async function signLabel(
  unsigned: UnsignedLabel,
  keypair: LabelSigner,
): Promise<SignedLabel> {
  const toSign = excludeNullish({
    ver: 1,
    src: unsigned.src,
    uri: unsigned.uri,
    cid: unsigned.cid,
    val: unsigned.val,
    neg: unsigned.neg === true ? true : undefined,
    cts: unsigned.cts,
    exp: unsigned.exp,
  });

  const bytes = encode(toSign as LexValue);
  const sig = await keypair.sign(bytes);

  const result: SignedLabel = {
    ver: 1,
    src: unsigned.src,
    uri: unsigned.uri,
    val: unsigned.val,
    cts: unsigned.cts,
    sig,
  };
  if (unsigned.neg === true) result.neg = true;
  if (unsigned.cid != null) result.cid = unsigned.cid;
  if (unsigned.exp != null) result.exp = unsigned.exp;
  return result;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a);
  result.set(b, a.length);
  return result;
}

function toLabelLex(label: SignedLabel): LexValue {
  return excludeNullish({
    ver: label.ver,
    src: label.src,
    uri: label.uri,
    cid: label.cid,
    val: label.val,
    neg: label.neg === true ? true : undefined,
    cts: label.cts,
    exp: label.exp,
    sig: label.sig,
  }) as LexValue;
}

export function encodeLabelsFrame(seq: number, label: SignedLabel): Uint8Array {
  const header = encode({ op: 1, t: "#labels" } as LexValue);
  const body = encode({ seq, labels: [toLabelLex(label)] } as LexValue);
  return concatBytes(header, body);
}

export function encodeErrorFrame(name: string, message: string): Uint8Array {
  const header = encode({ op: -1 } as LexValue);
  const body = encode({ error: name, message } as LexValue);
  return concatBytes(header, body);
}

export function formatLabelForHttp(label: SignedLabel): Record<string, unknown> {
  const base64 = Buffer.from(label.sig).toString("base64");
  return excludeNullish({
    ver: label.ver,
    src: label.src,
    uri: label.uri,
    cid: label.cid,
    val: label.val,
    neg: label.neg === true ? true : undefined,
    cts: label.cts,
    exp: label.exp,
    sig: { $bytes: base64 },
  });
}
