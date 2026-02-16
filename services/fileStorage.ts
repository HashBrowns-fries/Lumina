
import { get, set, del, keys } from 'idb-keyval';

const FILE_CONTENT_PREFIX = 'lute_content_';

export const saveLargeTextContent = async (id: string, content: string): Promise<void> => {
  await set(`${FILE_CONTENT_PREFIX}${id}`, content);
};

export const getLargeTextContent = async (id: string): Promise<string | undefined> => {
  return await get(`${FILE_CONTENT_PREFIX}${id}`);
};

export const deleteLargeTextContent = async (id: string): Promise<void> => {
  await del(`${FILE_CONTENT_PREFIX}${id}`);
};
