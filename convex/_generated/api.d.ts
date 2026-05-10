/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as assignedPlayers from "../assignedPlayers.js";
import type * as golf from "../golf.js";
import type * as golfRoster from "../golfRoster.js";
import type * as playChat from "../playChat.js";
import type * as syncTeamHoleScores from "../syncTeamHoleScores.js";
import type * as teamHoleScoreCanon from "../teamHoleScoreCanon.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  assignedPlayers: typeof assignedPlayers;
  golf: typeof golf;
  golfRoster: typeof golfRoster;
  playChat: typeof playChat;
  syncTeamHoleScores: typeof syncTeamHoleScores;
  teamHoleScoreCanon: typeof teamHoleScoreCanon;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
