import { UserModel, IUserDocument } from './../models/users-model';
import HTTPErrorResponse from './../lib/http/http-error-response';
import HTTPSuccessResponse from '../lib/http/http-success-response';
import { hash, compare } from 'bcrypt';
import { ERROR_CODES } from '../lib/error-codes';
import { MailHelper } from '../helpers/mailer'

export class UserController {
  private mailer : MailHelper;
  constructor() {
    this.mailer = MailHelper.getInstance();
  }

  async getAllUsers(body: any): Promise<HTTPErrorResponse | HTTPSuccessResponse> {

    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;

    try {

      const allUsers = UserModel.getAllUsers(body);
      const count = UserModel.countUsers(body);

      responseBody = new HTTPSuccessResponse({ list: await allUsers, count: await count });


    } catch (error: any) {
      console.log(error);
      responseBody = new HTTPErrorResponse([{ code: 500, message: error.message }]);
    }
    return responseBody;

  }


  async getUserById(body: any): Promise<HTTPErrorResponse | HTTPSuccessResponse> {

    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;
    try {

      const user = await UserModel.getUserById(body._id);
      responseBody = new HTTPSuccessResponse(user);

    } catch (error: any) {
      console.log(error);
      responseBody = new HTTPErrorResponse([{ code: 400, message: error.message }]);
    }
    return responseBody;

  }


  async deleteUserById(body: any): Promise<HTTPErrorResponse | HTTPSuccessResponse> {

    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;
    try {
      const user = await UserModel.getUserById(body._id);
      if(!user){
        return new HTTPErrorResponse([ERROR_CODES.INVALID_USER_ID]);
      }
      await UserModel.softDelete(body._id);
      responseBody = new HTTPSuccessResponse({});

    } catch (error: any) {
      console.log(error);
      responseBody = new HTTPErrorResponse([{ code: 500, message: error.message }]);
    }
    return responseBody;

  }


  async addUser(user: any): Promise<HTTPErrorResponse | HTTPSuccessResponse> {

    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;
    try {
      const usernameExists = await UserModel.getUserByUsername(user.username);

      if (usernameExists) {
        return responseBody = new HTTPErrorResponse([ERROR_CODES.USER_EXISTS]);
      }

      let newUser = await UserModel.addUser(user);
      // newUser.password = '';
      responseBody = new HTTPSuccessResponse(newUser);

    } catch (error: any) {
      console.log(error);
      responseBody = new HTTPErrorResponse([{ code: error.code || 500, message: error.message }]);
    }
    return responseBody;
  }


  async getUserByToken(token: string): Promise<IUserDocument | null> {

    const user = await UserModel.getUserByToken(token);

    return user;

  }


  async editUser(user: IUserDocument): Promise<HTTPErrorResponse | HTTPSuccessResponse> {

    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;
    try {
      const userExits = await UserModel.getUserById(user._id);
      if(!userExits){
        return new HTTPErrorResponse([ERROR_CODES.INVALID_USER_ID]);
      }
      const updatedUser = await UserModel.updateUser(user);
      
      responseBody = new HTTPSuccessResponse(updatedUser);

    } catch (error: any) {
      console.log(error);
      responseBody = new HTTPErrorResponse([{ code: 500, message: error.message }]);
    }
    return responseBody;
  }

  async activate(body: any): Promise<HTTPErrorResponse | HTTPSuccessResponse> {
    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;
    try {
      const email = body['email'];
      const code = body['code'];
      let user = await UserModel.getUserByEmail(email);
      const verified = await this.mailer.verifyActivateCode(user, code);
      console.log("-->", verified);
      if (verified && user) {
        user.isActive = true;
        const updatedUser = await UserModel.updateUser(user);
        responseBody = new HTTPSuccessResponse(updatedUser);
      } else {
        responseBody = new HTTPErrorResponse([{ code: 401, message: "Authentication Code is wrong!" }]);
      }
    } catch (error: any) {
      console.log(error);
      responseBody = new HTTPErrorResponse([{ code: 501, message: error.message }]);
    }
    return responseBody;
  }

  async resendMail(body: any): Promise<HTTPErrorResponse | HTTPSuccessResponse> {
    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;
    try {
      const email = body['email'];
      const user = await UserModel.getUserByEmail(email);
      const verifyCode = await this.mailer.createActivateCode(user);
      const activate_link = "http://localhost:3000/api/public/activate?email=" + email + "&code=" + verifyCode;
      const title = "[ProjectNotes] Please verify your Email address";
      const msgPlain = `Hey ${user?.username}!
      An ProjectNote account has been created with your email address ${email}, please click the link below to activate your account.
      ${activate_link}
      `;
      const msgHtml = `<html><body><p>Hey ${user?.username}!<br/>
      An ProjectNote account has been created with your email address ${email}, please click the link below to activate your account.<br/>
      <a href="${activate_link}" target="_blank">${activate_link}</a><br>
      </p></body></html>`;
      this.mailer.sendMail(msgPlain, msgHtml, title, email)
      responseBody = new HTTPSuccessResponse(user);
    } catch (error: any) {
      console.log(error);
      responseBody = new HTTPErrorResponse([{ code: 501, message: error.message }]);
    }
    return responseBody;
  }

  async changePassword(user: any): Promise<HTTPErrorResponse | HTTPSuccessResponse> {

    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;
    try {
      const userData = await UserModel.getUserById(user._id);

      if (userData && await compare(user.oldPassword, <string> userData.password)) {

        const hashedPassword = await hash(user.newPassword, 10);

        user.newPassword = hashedPassword;

        const updatedUser = await UserModel.changePassword(user);
        responseBody = new HTTPSuccessResponse({});
      } else {

        responseBody = new HTTPErrorResponse([ERROR_CODES.INVALID_OLD_PASS]);
      }

    } catch (error: any) {
      console.log(error);
      responseBody = new HTTPErrorResponse([{ code: error.code || 500, message: error.message }]);
    }
    return responseBody;
  }

}
