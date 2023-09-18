import { UserModel, IUserDocument } from './../models/users-model';
import HTTPErrorResponse from './../lib/http/http-error-response';
import HTTPSuccessResponse from '../lib/http/http-success-response';
import { Request } from 'express';
import { hash, compare } from 'bcrypt';
import { PermissionsList } from '../lib/cached-permissions';
import { ERROR_CODES } from '../lib/error-codes';
import { TokenPayload } from '../dto/token-payload';
import { JwtHelper } from '../helpers/jwt-helper';
import { MailHelper } from '../helpers/mailer'

export class AuthController {
  private mailer : MailHelper = MailHelper.getInstance();;
  jwtHelper : JwtHelper = JwtHelper.getInstance();

  constructor() {}

  async login(body: any): Promise<HTTPErrorResponse | HTTPSuccessResponse> {
    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;

    try {
      const user = await UserModel.getUserByUsername(body.username);

      // If User Exists and hashed password match given password
      if (user && await compare(body.password, <string>user.password)) {
        // Token Obj
        let tokenPayload = new TokenPayload(user) ; 

        // Generate tokens
        const accessToken = await this.jwtHelper.getAccessToken(tokenPayload);
        const refreshToken = await this.jwtHelper.getRefreshToken(tokenPayload);

        // Add session to user
        const updatedUser = await UserModel.addSession(user, refreshToken);

        if (updatedUser) {
          responseBody = new HTTPSuccessResponse({
            accessToken, 
            // refreshToken,
            user
          });
        } else {
          responseBody = new HTTPErrorResponse([ERROR_CODES.GENERATE_TOKEN]);
        }

      } else {
        responseBody = new HTTPErrorResponse([
          ERROR_CODES.WRONG_USERNAME_OR_PASS
        ]);
      }
    } catch (error) {
      console.log(error);
      responseBody = new HTTPErrorResponse([
        ERROR_CODES.WRONG_USERNAME_OR_PASS
      ]);
    }

    return responseBody;
  }


  async refreshToken(token: string): Promise<HTTPErrorResponse | HTTPSuccessResponse> {
    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;

    try {
      const user = await UserModel.getUserByToken(token);

      
      // If User Exists 
      if (user) {
        // Token Obj

        let tokenPayload = new TokenPayload(user) ; 

        // Generate tokens
        const accessToken = await this.jwtHelper.getAccessToken(tokenPayload);
        const refreshToken = await this.jwtHelper.getRefreshToken(tokenPayload);

        // Add session to user
        const updatedUser = await UserModel.addSession(user, refreshToken);

        if (updatedUser) {
          responseBody = new HTTPSuccessResponse({
            accessToken, 
            refreshToken
          });
        } else {
          responseBody = new HTTPErrorResponse([ERROR_CODES.GENERATE_TOKEN]);
        }

      } else {
        responseBody = new HTTPErrorResponse([
          ERROR_CODES.INVALID_TOKEN
        ]);
      }
    } catch (error) {
      console.log(error);
      responseBody = new HTTPErrorResponse([
        ERROR_CODES.INVALID_TOKEN
      ]);
    }

    return responseBody;
  }

  // Login As For Super user only who can login as any user
  async loginAs(_id: any): Promise<HTTPErrorResponse | HTTPSuccessResponse> {
    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;

    try {
      // Get User who want to login as him
      const user = await UserModel.getUserById(_id);

      if (user) {
        let tokenPayload = new TokenPayload(user) ; 
        // Generate tokens
        const accessToken = await this.jwtHelper.getAccessToken(tokenPayload);
        const userToken = <IUserDocument>  await UserModel.getUserRefreshToken(user.id);
        let refreshToken : string ; 
        if(!userToken.refreshToken){

          refreshToken = await this.jwtHelper.getRefreshToken(tokenPayload);
          
          // Add session to user
          await UserModel.addSession(user, refreshToken);

        }else{
          refreshToken = userToken.refreshToken;
        }

        responseBody = new HTTPSuccessResponse({
          accessToken, 
          refreshToken: refreshToken
        });

      } else {
        responseBody = new HTTPErrorResponse([ERROR_CODES.INVALID_USER_ID]);
      }
    } catch (error) {
      responseBody = new HTTPErrorResponse([ERROR_CODES.INVALID_USER_ID]);
    }

    return responseBody;
  }

  async logout(
    token: string
  ): Promise<HTTPErrorResponse | HTTPSuccessResponse> {
    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;

    const user = await this.jwtHelper.getAccessTokenPayload(token);
    
    await UserModel.logout(user._id);

    responseBody = new HTTPSuccessResponse({});

    return responseBody;
  }

  // Generate Reset passsword token
  async generateResetPasswordToken(
    username: string
  ): Promise<HTTPErrorResponse | HTTPSuccessResponse> {
    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;
    try {

      const user = await UserModel.getUserByUsername(username);

      if (!user) {
        responseBody = new HTTPErrorResponse([ERROR_CODES.INVALID_USER_NAME]);
      } else {
        await UserModel.generateResetPasswordToken(username);
        const updatedUser = await UserModel.getUserByEmail(user.email);
        responseBody = new HTTPSuccessResponse({});
        const resetPass = updatedUser?.resetPassword;

        // Send Mail Here ----------------------->
        if (resetPass && "token" in resetPass) {
          const activate_link = "http://localhost:3000/resetpassword?username=" + user.username + "&token=" + resetPass.token;
          const title = "[ProjectNotes] Reset your password";
          const msgPlain = `Hey ${user?.username}!
          You had request to reset password on ProjectNote please click the link below to reset the password.
          ${activate_link}
          `;
          const msgHtml = `<html><body><p>Hey ${user?.username}!<br/>
          You had request to reset password on ProjectNote, please click the link below to reset your password.<br/>
          <a href="${activate_link}" target="_blank">${activate_link}</a><br>
          If It is not your intention, please ignore it.
          </p></body></html>`;
          this.mailer.sendMail(msgPlain, msgHtml, title, user.email)
        }  
      }
    } catch (error) {
      responseBody = new HTTPErrorResponse([ERROR_CODES.UNEXPECTED_ERROR]);
    }

    return responseBody;
  }

  // Reset password by generated token
  async changePasswordByToken(
    token: string,
    newPassword: string
  ): Promise<HTTPErrorResponse | HTTPSuccessResponse> {
    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;

    try {
      const tokenExists = await UserModel.resetPasswordTokenExists(token);

      if( !tokenExists){
        responseBody = new HTTPErrorResponse([ERROR_CODES.INVALID_TOKEN]); 
      }else{
        const hashedPassword = await hash(newPassword, 10);

        newPassword = hashedPassword;
        await UserModel.changePasswordByToken(token, newPassword);
        responseBody = new HTTPSuccessResponse({});
  
      }
    } catch (error) {
      responseBody = new HTTPErrorResponse([ERROR_CODES.UNEXPECTED_ERROR]);
    }

    return responseBody;
  }

  // Check if user permissions contain request URL and Method
  async isAuthorized(user: TokenPayload , request: Request): Promise<boolean> {
    let isAuthorized = false;

    if (user && user._id) {
      /*
       * Foreach user permission split url
       * Split request path
       * If permission url contains ? that's mean this is path param
       *     => change request url path param to be ? to compare permission against the request url
       *     => /changeUserByID/1231231231  => /changeUserByID/?
       */
      user.groups.forEach(group=>{
        group.permissions.forEach(permission => {
          let requestPath = request.path.split('/');

          permission.path.split('/').forEach((path, index, fullPath) => {
            if (path == '?' && requestPath[index]) {
              requestPath[index] = '?';
            }
          });

          // let requestPath = request.path;
          // let perRegex = '^' + permission.path.replace(/\?/g,'[^\/]+').replace(/\//g,'\/') + '$';
          // var re = new RegExp(perRegex);
          
          if (
            permission.path.toLowerCase() === requestPath.join('/').toLowerCase() &&
            permission.method.toLowerCase() === request.method.toLowerCase()
          ) {
            isAuthorized = true;
            return;
          }
        });
      });
    }
    return isAuthorized;
  }

  /*
   *
   * If Request URL and Method not exists in permissions list so it's public WS
   * If It exists ?
   *   1st => if is default permission so no need to check if user has permission in user permissions list
   *   2nd => if not default so user should have the permission in user permissions list
   *   3rd => if permission required so token should be required to get user permissions by token
   *
   *
   */
  checkPermissions(
    request: Request
  ): { tokenRequired: boolean; permissionRequired: boolean } {
    let tokenRequired = false;
    let permissionRequired = false;

    PermissionsList.getPermissionsList().forEach(permission => {
      let requestPath = request.path.split('/');

      permission.path.split('/').forEach((path, index, fullPath) => {
        if (path == '?' && requestPath[index]) {
          requestPath[index] = '?';
        }
      });

      // If request url and method exists in permissions list
      if (
        permission.path.toLowerCase() === requestPath.join('/').toLowerCase() &&
        permission.method.toLowerCase() === request.method.toLowerCase()
      ) {
        permissionRequired = !permission.isDefault;
        tokenRequired = true;
        return;
      }
    });
    console.log({ permissionRequired, tokenRequired });
    return { permissionRequired, tokenRequired };
  }

  async getUserByToken(
    token: string
  ): Promise<HTTPErrorResponse | HTTPSuccessResponse> {
    let responseBody: HTTPErrorResponse | HTTPSuccessResponse;

    try {

      const tokenPayload = await this.jwtHelper.getAccessTokenPayload(token);
      
      const user = await UserModel.getUserById(tokenPayload._id);

      if (user) {
        responseBody = new HTTPSuccessResponse(user);
      } else {
          responseBody = new HTTPErrorResponse([ERROR_CODES.INVALID_TOKEN]);
      }
    } catch (error) {
      console.log(error);
      responseBody = new HTTPErrorResponse([ERROR_CODES.INVALID_TOKEN]);
    }

    return responseBody;
  }

}
