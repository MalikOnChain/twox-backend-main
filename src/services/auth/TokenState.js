export const TOKEN_STATE = []; // [{ identifier: String, token: String }]
// Function to add token to the state
export const addTokenToState = (identifier, accessToken, refreshToken) =>
  TOKEN_STATE.push({ identifier, accessToken, refreshToken });

export const getTokenFromState = (identifier) => TOKEN_STATE.find((token) => token.identifier === identifier);

export const removeTokenFromState = (identifier) => TOKEN_STATE.filter((token) => token.identifier !== identifier);
