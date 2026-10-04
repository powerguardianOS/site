import { mails, check, done } from './harness.mts';
import { sendReconfirmCode, verifyReconfirmCode, isReconfirmed } from '../app/lib/owner.ts';

const E = 'cust@x.nl';
console.log('e-mail re-confirmation');
await sendReconfirmCode(E);
const code = mails.at(-1)!.text.match(/code is: (\d{6})/)![1];
check('a 6-digit code is mailed to the account address', mails.at(-1)!.to === E && /^\d{6}$/.test(code));
check('a wrong code does not confirm', (await verifyReconfirmCode(E, 'sess1', '000000')) === false && (await isReconfirmed('sess1')) === false);
check('the right code confirms THIS session only', (await verifyReconfirmCode(E, 'sess1', code)) === true && (await isReconfirmed('sess1')) === true && (await isReconfirmed('sess2')) === false);
check('a code works once', (await verifyReconfirmCode(E, 'sess2', code)) === false);
await sendReconfirmCode(E);
const code2 = mails.at(-1)!.text.match(/code is: (\d{6})/)![1];
for (let i = 0; i < 5; i++) await verifyReconfirmCode(E, 's3', '999999');
check('five wrong tries burn the code, even the right one is refused after', (await verifyReconfirmCode(E, 's3', code2)) === false);
check('the code is not sent to anyone else', mails.every((m) => m.to === E));
done();
