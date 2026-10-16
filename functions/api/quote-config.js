import {publicConfig} from '../../server/quote.mjs';
export const onRequestGet = ({env}) => publicConfig(env);
