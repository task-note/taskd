import { Document, Schema, Model, model, Query } from 'mongoose';

export interface IPermissionsDocument extends Document {
  name: string;
  path: string;
  method: string;
  isDefault: boolean;
}

export interface IPermissionsModel extends Model<IPermissionsDocument> {
  getAllPermissions(): Query<
    IPermissionsDocument[],
    IPermissionsDocument,
    {}
  >;
}

export let PermissionsSchema: Schema = new Schema({
  name: String,
  path: String,
  method: String,
  isDefault: Boolean
});

PermissionsSchema.statics.getAllPermissions = function(): Query<
  IPermissionsDocument[],
  IPermissionsDocument,
  {}
> {
  return (<IPermissionsModel>this).find();
};

export const PermissionsModel: IPermissionsModel = model<
  IPermissionsDocument,
  IPermissionsModel
>('Permission', PermissionsSchema);
