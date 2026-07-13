import { get } from "./http";

/** The relative rotation graph and the rotation leaders/laggards feed. */

export type RrgTrailPoint = {
  date: string;
  ratio: number;
  momentum: number;
};

export type RrgCategoryEntry = {
  id: string;
  name: string;
  color: string;
  quadrant: number;
  trail: RrgTrailPoint[];
};

export type RrgResponse = {
  date: string;
  categories: RrgCategoryEntry[];
};

export type RotationLeaderEntry = {
  categoryId: string;
  categoryName: string;
  compositeScore: number | null;
  relativeStrength60Day: number | null;
  relativeRotationGraphQuadrant: number | null;
};

export type RotationEventEntry = {
  detectedDate: string;
  categoryId: string;
  categoryName: string;
  eventType: string;
  confidence: number;
  notes: string;
};

export type RotationResponse = {
  asOfDate: string;
  topLeaders: RotationLeaderEntry[];
  bottomLaggards: RotationLeaderEntry[];
  recentEvents: RotationEventEntry[];
};

export const fetchRrg = () => get<RrgResponse>("/api/v1/rrg");

export const fetchRotation = () => get<RotationResponse>("/api/v1/rotation");
