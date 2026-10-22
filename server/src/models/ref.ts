import { Schema } from "mongoose";

/**
 * Builds a `ref` path definition for a field whose document type is `string`.
 *
 * Mongoose's schema typings only accept `SchemaTypes.ObjectId` for a field
 * declared as `Types.ObjectId`, but this codebase addresses every reference by
 * its plain string id: routes filter and compare string ids, and the lean
 * payloads sent to the client are strings. Declaring the fields as
 * `Types.ObjectId` would mean rewriting every comparison in the routes and
 * services, so the runtime definition stays an ObjectId and this helper is the
 * one place the two are deliberately allowed to disagree.
 */
export const ref = (model: string, options: { required?: boolean; default?: string } = {}): any => ({
  type: Schema.Types.ObjectId,
  ref: model,
  ...options,
});

/**
 * Reads a ref field as a hex string whether it is still a raw ObjectId or has
 * been populated into a document.
 */
export const refId = (value: unknown): string => {
  if (!value) return "";
  const populated = value as { _id?: unknown };
  const id = populated._id ?? value;
  const oid = id as { toHexString?: () => string };
  if (typeof oid.toHexString === "function") return oid.toHexString();
  return String(id);
};
