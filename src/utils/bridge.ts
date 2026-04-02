import { safeCall } from "./goBridge.js";

/**
 * 封装后端调用，增加解析校验与详细日志
 */
export const safeCallParse = async (method: string, params?: object) => {
  try {
    console.log(`[safeCall] ${method}`, params);
    const response = params 
      ? await safeCall("main", method, JSON.stringify(params))
      : await safeCall("main", method);
    
    console.log(`[safeCall] ${method} response:`, response);
    
    if (!response) {
      throw new Error(`[${method}] 返回数据为空`);
    }
    
    const data = JSON.parse(response);
    return data;
  } catch (err: any) {
    console.error(`[safeCall] ${method} error:`, err);
    throw err;
  }
};
