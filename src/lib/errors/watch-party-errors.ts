/**
 * Custom error classes for Watch Party feature
 * Provides structured error handling with HTTP status codes
 */

export class WatchPartyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "WatchPartyError";
  }
}

// 400 Bad Request Errors
export class BadRequestError extends WatchPartyError {
  constructor(message: string, code: string = "BAD_REQUEST") {
    super(message, code, 400);
    this.name = "BadRequestError";
  }
}

// 401 Unauthorized Errors
export class UnauthorizedError extends WatchPartyError {
  constructor(message: string = "Bạn chưa đăng nhập hoặc phiên đã hết hạn") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

// 403 Forbidden Errors
export class ForbiddenError extends WatchPartyError {
  constructor(message: string, code: string = "FORBIDDEN") {
    super(message, code, 403);
    this.name = "ForbiddenError";
  }
}

// 404 Not Found Errors
export class NotFoundError extends WatchPartyError {
  constructor(message: string, code: string = "NOT_FOUND") {
    super(message, code, 404);
    this.name = "NotFoundError";
  }
}

// 409 Conflict Errors
export class ConflictError extends WatchPartyError {
  constructor(message: string, code: string = "CONFLICT") {
    super(message, code, 409);
    this.name = "ConflictError";
  }
}

// Specific Watch Party Errors
export class RoomNotFoundError extends NotFoundError {
  constructor(message: string = "Phòng không tồn tại hoặc đã đóng") {
    super(message, "ROOM_NOT_FOUND");
  }
}

export class RoomClosedError extends NotFoundError {
  constructor(message: string = "Phòng này đã kết thúc") {
    super(message, "ROOM_CLOSED");
  }
}

export class RoomFullError extends ForbiddenError {
  constructor(message: string = "Phòng đã đầy, không thể tham gia") {
    super(message, "ROOM_FULL");
  }
}

export class NotMemberError extends ForbiddenError {
  constructor(message: string = "Bạn không phải là thành viên của phòng này") {
    super(message, "NOT_MEMBER");
  }
}

export class NotHostError extends ForbiddenError {
  constructor(message: string = "Chỉ Chủ phòng mới được thực hiện thao tác này") {
    super(message, "NOT_HOST");
  }
}

export class ChatDisabledError extends ForbiddenError {
  constructor(message: string = "Chat đã bị tắt trong phòng này") {
    super(message, "CHAT_DISABLED");
  }
}

export class UserMutedError extends ForbiddenError {
  constructor(message: string = "Bạn đã bị cấm chat trong phòng này") {
    super(message, "USER_MUTED");
  }
}

export class NoPermissionError extends ForbiddenError {
  constructor(message: string = "Bạn không có quyền thực hiện thao tác này") {
    super(message, "NO_PERMISSION");
  }
}

export class ConfigurationError extends WatchPartyError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR", 500);
    this.name = "ConfigurationError";
  }
}

/**
 * Helper function to convert WatchPartyError to HTTP response
 */
export function getErrorResponse(error: unknown): {
  message: string;
  statusCode: number;
} {
  if (error instanceof WatchPartyError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  // Default to 500 for unknown errors
  return {
    message: "Internal Server Error",
    statusCode: 500,
  };
}
