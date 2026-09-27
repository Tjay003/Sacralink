import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export interface ParsedAuthParams {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  type?: string;
  error?: string;
  errorCode?: string;
  errorDescription?: string;
  rawParams: Record<string, string>;
  pathname?: string;
}

/**
 * Parses authentication tokens, PKCE codes, and errors from deep link URLs.
 * Handles both URL fragment/hash params (#access_token=...) and query params (?code=...).
 */
export function parseAuthUrl(url: string): ParsedAuthParams {
  const rawParams: Record<string, string> = {};
  let pathname = '';

  try {
    const parsed = Linking.parse(url);
    if (parsed.path) {
      pathname = parsed.path;
    }
    if (parsed.queryParams) {
      for (const [key, value] of Object.entries(parsed.queryParams)) {
        if (typeof value === 'string') {
          rawParams[key] = value;
        } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
          rawParams[key] = value[0];
        }
      }
    }
  } catch (err) {
    console.warn('Linking.parse failed to parse URL:', err);
  }

  // Parse URL fragment (#...) commonly used by Supabase implicit grant
  const hashIndex = url.indexOf('#');
  if (hashIndex !== -1) {
    const hashString = url.substring(hashIndex + 1);
    const hashPairs = hashString.split('&');
    for (const pair of hashPairs) {
      const [k, v] = pair.split('=');
      if (k && v !== undefined) {
        rawParams[decodeURIComponent(k)] = decodeURIComponent(v);
      }
    }
  }

  // Parse query string (?...) if Linking.parse missed anything
  const queryIndex = url.indexOf('?');
  if (queryIndex !== -1) {
    const end = hashIndex !== -1 && hashIndex > queryIndex ? hashIndex : url.length;
    const queryString = url.substring(queryIndex + 1, end);
    const queryPairs = queryString.split('&');
    for (const pair of queryPairs) {
      const [k, v] = pair.split('=');
      if (k && v !== undefined) {
        rawParams[decodeURIComponent(k)] = decodeURIComponent(v);
      }
    }
  }

  return {
    accessToken: rawParams['access_token'],
    refreshToken: rawParams['refresh_token'],
    code: rawParams['code'],
    type: rawParams['type'],
    error: rawParams['error'],
    errorCode: rawParams['error_code'],
    errorDescription: rawParams['error_description'] || rawParams['error'],
    rawParams,
    pathname,
  };
}

/**
 * Exchanges or sets a session with Supabase based on incoming deep link params.
 */
export async function handleAuthUrlSession(url: string) {
  const params = parseAuthUrl(url);

  if (params.error) {
    return {
      success: false,
      error: new Error(params.errorDescription || params.error),
      params,
    };
  }

  if (params.accessToken && params.refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) {
      return { success: false, error, params };
    }
    return { success: true, session: data.session, user: data.user, params };
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) {
      return { success: false, error, params };
    }
    return { success: true, session: data.session, user: data.user, params };
  }

  return {
    success: false,
    error: new Error('No authentication tokens or codes found in URL.'),
    params,
  };
}
