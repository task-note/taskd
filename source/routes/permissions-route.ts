import express from 'express';
import HTTPErrorResponse from '../lib/http/http-error-response';
import HTTPSuccessResponse from '../lib/http/http-success-response';
import { PermissionsController } from '../controllers/permissions-controller';

export class PermissionsRoutes {
  router: express.Router = express.Router();
  permissionsController: PermissionsController;

  constructor() {
    this.permissionsController = new PermissionsController();
    this.constructRoutes();
  }

  constructRoutes() {
    this.router.get(
      '/',
      async (
        request: express.Request,
        response: express.Response,
        next: express.NextFunction
      ) => {
        let responseBody: HTTPErrorResponse | HTTPSuccessResponse;

        responseBody = await this.permissionsController.getAllPermissions();

        response.status(200);
        response.json(responseBody);
      }
    );
  }
}
