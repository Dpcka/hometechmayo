import {handleQuote} from '../../server/quote.mjs';
export const onRequest = context => handleQuote(context);
