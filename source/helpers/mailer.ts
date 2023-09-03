import { compare, getRounds, hash } from "bcrypt";
import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

export class MailHelper {
    private static _mailHelper = new MailHelper();
    private _transporter : Mail;
    private MAIL_HOST = process.env.MAIL_HOST;
    private MAIL_PORT = parseInt(process.env.MAIL_PORT as string);
    private MAIL_USERNAME = process.env.MAIL_USERNAME;
    private MAIL_PASSWD = process.env.MAIL_PASSWD;
    private ACTIVATE_SALT = process.env.ACTIVATE_SALT;

    private constructor() {
        this._transporter = nodemailer.createTransport({
                host: this.MAIL_HOST,
                //service: 'gmail',
                port: this.MAIL_PORT,
                secure: false,
                //requireTLS: true,
                logger: true,
                auth: {
                  user: this.MAIL_USERNAME,
                  pass: this.MAIL_PASSWD // naturally, replace both with your real credentials or an application-specific password
                }
            });
        }

    static getInstance() {
      return MailHelper._mailHelper;
    }
  
    public async sendMail(msgPlain: string, msgHtml: string, title: string, email: string) {
        const info = await this._transporter.sendMail({
            //from: `"Tasknote Top" <${this.MAIL_USERNAME}>`,
            //from: `admin@tasknote.top`,
            from: `oeichenwei@msn.com`,
            to: email,
            subject: title,
            text: msgPlain,
            html: msgHtml
          });
        
        console.log("Message sent: %s", info.response);
    }

    public async createActivateCode(user: any) : Promise<string> {
        const content = `${user.email}+${user.createdAt.getTime()}+${user.password}+${this.ACTIVATE_SALT}`;
        const activateCode = await hash(content, 10);
        return activateCode;
    }

    public async verifyActivateCode(user: any, code: string) : Promise<boolean> {
      const content = `${user.email}+${user.createdAt.getTime()}+${user.password}+${this.ACTIVATE_SALT}`;
      const ret = await compare(content, code);
      return ret;
    }
}
