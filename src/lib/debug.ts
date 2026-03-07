export const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'

export function debugLog(context: string, message: string, data?: unknown) {
  if (!isDebugMode) return
  console.log(`[Dalli] [${context}]`, message, data !== undefined ? data : '')
}

export function debugError(context: string, message: string, error?: unknown) {
  // 에러는 디버그 모드가 아니어도 항상 콘솔에 출력
  console.error(`[Dalli] [${context}]`, message, error !== undefined ? error : '')
}

export function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    ),
  ])
}
