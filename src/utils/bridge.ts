import { safeCall } from "./goBridge.js";

/**
 * 封装后端调用，增加解析校验与详细日志
 */
export const safeCallParse = async <T>(method: string, params?: object): Promise<T> => {
  try {
    if (import.meta.env.DEV) {
      console.log(`[safeCall] ${method}`, params);
    }
    const response = params 
      ? await safeCall("main", method, JSON.stringify(params))
      : await safeCall("main", method);
    
    if (import.meta.env.DEV) {
      console.log(`[safeCall] ${method} response:`, response);
    }
    
    if (!response || response === "null") {
      throw new Error(`[${method}] 返回数据为空`);
    }
    
    const data = JSON.parse(response) as T;

    if (data === null || data === undefined) {
      throw new Error(`[${method}] 返回数据为空`);
    }

    return data;
  } catch (err: unknown) {
    console.error(`[safeCall] ${method} error:`, err);
    throw err;
  }
};
