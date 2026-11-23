export const PIPELINE_STATUSES = Object.freeze([
  'planned',
  'active',
  'inactive',
  'decommissioned',
]);

export const SEGMENT_STATUSES = PIPELINE_STATUSES;

export const PIPELINE_RISK_LEVELS = Object.freeze([
  'low',
  'medium',
  'high',
  'critical',
]);

export const PIPELINE_VISIBILITY_POLICIES = Object.freeze([
  'public',
  'reference',
  'authorized',
  'customer',
  'private',
]);

export class PipelineWatchContractError extends TypeError {
  constructor(code, field, message) {
    super(message);
    this.name = 'PipelineWatchContractError';
    this.code = code;
    this.field = field;
  }
}

function fail(code, field, message) {
  throw new PipelineWatchContractError(code, field, message);
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map((entry) => clone(entry));
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
    );
  }
  return value;
}

function deepFreeze(value) {
  if (value instanceof Date || value === null || typeof value !== 'object') {
    return value;
  }
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

function requireRecord(value, field = 'record') {
  if (!isPlainObject(value)) {
    fail('record_required', field, `${field} must be an object`);
  }
}

function requireId(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('id_required', field, `${field} must be a non-empty string`);
  }
  return value;
}

function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail('text_required', field, `${field} must be a non-empty string`);
  }
  return value;
}

function requireStringList(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    fail('list_required', field, `${field} must be a non-empty array`);
  }
  if (value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    fail(
      'list_strings_required',
      field,
      `${field} must contain non-empty strings`,
    );
  }
}

function validatePosition(position, field) {
  if (!Array.isArray(position) || position.length < 2 || position.length > 3) {
    fail(
      'coordinate_required',
      field,
      `${field} must be a [longitude, latitude] position`,
    );
  }
  const [longitude, latitude, altitude] = position;
  if (
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    fail(
      'longitude_invalid',
      field,
      `${field} longitude must be within [-180, 180]`,
    );
  }
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    fail(
      'latitude_invalid',
      field,
      `${field} latitude must be within [-90, 90]`,
    );
  }
  if (
    position.length === 3 &&
    (typeof altitude !== 'number' || !Number.isFinite(altitude))
  ) {
    fail(
      'altitude_invalid',
      field,
      `${field} altitude must be a finite number`,
    );
  }
}

function validateLineCoordinates(coordinates, field) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    fail(
      'geometry_coordinates_required',
      field,
      `${field} must contain at least two positions`,
    );
  }
  coordinates.forEach((position, index) =>
    validatePosition(position, `${field}[${index}]`),
  );
}

/** Validate a GeoJSON LineString or MultiLineString route geometry. */
export function validateGeometry(geometry, field = 'geometry') {
  requireRecord(geometry, field);
  const value = geometry.type === 'Feature' ? geometry.geometry : geometry;
  if (!isPlainObject(value)) {
    fail('geometry_required', field, `${field} must contain a geometry object`);
  }

  if (value.type === 'LineString') {
    validateLineCoordinates(value.coordinates, `${field}.coordinates`);
    return geometry;
  }
  if (value.type === 'MultiLineString') {
    if (!Array.isArray(value.coordinates) || value.coordinates.length === 0) {
      fail(
        'geometry_coordinates_required',
        field,
        `${field} must contain line coordinates`,
      );
    }
    value.coordinates.forEach((line, index) => {
      validateLineCoordinates(line, `${field}.coordinates[${index}]`);
    });
    return geometry;
  }
  fail(
    'geometry_type_invalid',
    field,
    `${field} must be a GeoJSON LineString or MultiLineString`,
  );
}

function validateStatus(value, field) {
  requireText(value, field);
}

function validateRiskLevel(value, field) {
  requireText(value, field);
}

function validateVisibilityPolicy(value) {
  if (typeof value === 'string') {
    if (value.trim() === '') {
      fail(
        'visibility_policy_invalid',
        'visibilityPolicy',
        'visibilityPolicy must be a non-empty string or object',
      );
    }
    return;
  }
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    fail(
      'visibility_policy_invalid',
      'visibilityPolicy',
      'visibilityPolicy must be a non-empty string or object',
    );
  }
}

function validateTimestamp(value) {
  if (
    !(value instanceof Date) &&
    (typeof value !== 'string' ||
      value.trim() === '' ||
      !Number.isFinite(Date.parse(value)))
  ) {
    fail(
      'timestamp_invalid',
      'updatedAt',
      'updatedAt must be a valid date or timestamp string',
    );
  }
}

function validateSource(value) {
  if (typeof value === 'string') {
    requireText(value, 'source');
    return;
  }
  if (!isPlainObject(value) || Object.keys(value).length === 0) {
    fail(
      'source_invalid',
      'source',
      'source must be a non-empty string or object',
    );
  }
}

function validateCountryRegionFields(record) {
  const countries = record.countries;
  const regions = record.regions;
  if (countries === undefined && regions === undefined) {
    fail(
      'location_required',
      'countries/regions',
      'countries or regions is required',
    );
  }
  if (countries !== undefined) requireStringList(countries, 'countries');
  if (regions !== undefined) requireStringList(regions, 'regions');
}

/** Validate a Pipeline record without changing or publishing it. */
export function validatePipeline(pipeline) {
  requireRecord(pipeline, 'pipeline');
  requireId(pipeline.id, 'id');
  requireText(pipeline.name, 'name');
  requireText(pipeline.operator, 'operator');
  requireText(pipeline.product, 'product');
  validateCountryRegionFields(pipeline);
  validateGeometry(pipeline.route, 'route');
  requireText(pipeline.timezone, 'timezone');
  validateStatus(pipeline.status, 'status');
  validateRiskLevel(pipeline.riskLevel, 'riskLevel');
  validateVisibilityPolicy(pipeline.visibilityPolicy);
  validateSource(pipeline.source);
  validateTimestamp(pipeline.updatedAt);
  return pipeline;
}

/** Validate a Segment record and, when supplied, its parent pipeline. */
export function validateSegment(segment, parentPipeline) {
  requireRecord(segment, 'segment');
  requireId(segment.id, 'id');
  requireId(segment.pipelineId, 'pipelineId');
  requireText(segment.name, 'name');
  validateGeometry(segment.geometry);
  requireText(segment.segmentType, 'segmentType');
  validateRiskLevel(segment.riskLevel, 'riskLevel');
  validateStatus(segment.status, 'status');

  if (parentPipeline !== undefined) {
    if (parentPipeline === null) {
      fail(
        'parent_pipeline_missing',
        'pipelineId',
        'segment parent pipeline is required',
      );
    }
    validatePipeline(parentPipeline);
    if (segment.pipelineId !== parentPipeline.id) {
      fail(
        'segment_owner_mismatch',
        'pipelineId',
        `segment pipelineId ${segment.pipelineId} does not match pipeline ${parentPipeline.id}`,
      );
    }
  }
  return segment;
}

/** Validate both records and their ownership relationship as one boundary check. */
export function validatePipelineAndSegment(pipeline, segment) {
  validatePipeline(pipeline);
  validateSegment(segment, pipeline);
  return { pipeline, segment };
}

/** Publish an immutable Pipeline record. */
export function createPipeline(input) {
  const pipeline = clone(input);
  validatePipeline(pipeline);
  return deepFreeze(pipeline);
}

/**
 * Publish an immutable Segment record. The second argument must be the parent
 * pipeline directly or `{ pipeline }`, which keeps the ownership check
 * explicit at call sites.
 */
export function createSegment(input, parentOrOptions) {
  const segment = clone(input);
  const parentPipeline =
    parentOrOptions === undefined
      ? null
      : parentOrOptions && Object.hasOwn(parentOrOptions, 'pipeline')
        ? parentOrOptions.pipeline
        : parentOrOptions;
  validateSegment(segment, parentPipeline);
  return deepFreeze(segment);
}

// Explicit record aliases make the contract convenient for callers that use
// domain-oriented factory names.
export const createPipelineRecord = createPipeline;
export const createSegmentRecord = createSegment;
