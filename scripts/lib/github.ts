const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const MAX_ATTEMPTS = 4;

export type GraphQLVariables = Record<string, string | number | boolean | null>;

export type GraphQLClient = <T>(query: string, variables?: GraphQLVariables) => Promise<T>;

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string; type?: string; path?: (string | number)[] }[];
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** GitHub occasionally answers heavy GraphQL queries with 502/503/504; those are safe to retry. */
const isRetryable = (status: number): boolean => status === 502 || status === 503 || status === 504;

export function createGraphQLClient(token: string): GraphQLClient {
  return async function request<T>(query: string, variables: GraphQLVariables = {}): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'spacesdrive-profile-stats',
        },
        body: JSON.stringify({ query, variables }),
      });

      if (isRetryable(response.status) && attempt < MAX_ATTEMPTS) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}\n${await response.text()}`);
      }

      const body = (await response.json()) as GraphQLResponse<T>;
      if (body.errors?.length) {
        const messages = body.errors.map((error) => `- ${error.message}`).join('\n');
        throw new Error(`GitHub GraphQL returned errors:\n${messages}`);
      }
      if (!body.data) throw new Error('GitHub GraphQL response contained no data');
      return body.data;
    }
  };
}
