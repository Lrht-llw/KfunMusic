export interface CookieItem {
  domain: string;
  flag: boolean;
  path: string;
  secure: boolean;
  expires: number;
  name: string;
  value: string;
}

export function parseNetscapeCookie(content: string): CookieItem[] {
  const cookies: CookieItem[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }
    
    const parts = trimmedLine.split('\t');
    if (parts.length < 7) {
      continue;
    }
    
    cookies.push({
      domain: parts[0],
      flag: parts[1] === 'TRUE',
      path: parts[2],
      secure: parts[3] === 'TRUE',
      expires: parseInt(parts[4], 10),
      name: parts[5],
      value: parts.slice(6).join('\t'),
    });
  }
  
  return cookies;
}

export function cookiesToHeader(cookies: CookieItem[]): string {
  const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  return cookieString;
}

export function getDouyinCookieFromNetscape(content: string): string {
  const cookies = parseNetscapeCookie(content);
  const douyinCookies = cookies.filter((c) => c.domain.includes('douyin'));
  
  if (douyinCookies.length === 0) {
    return '';
  }
  
  return cookiesToHeader(douyinCookies);
}
