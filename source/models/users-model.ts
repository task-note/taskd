import { IPermissionsModel, IPermissionsDocument } from './permissions-model';
import { IGroupsDocumnet } from './groups-model';
import {
  Document,
  Schema,
  Model,
  model,
  Query,
  SortOrder,
  UpdateWriteOpResult
} from 'mongoose';
import { ObjectId } from 'mongodb';

export interface IUserDocument extends Document {
  email: string;
  username: string;
  password?: string;
  displayName?: string;
  type?: string;
  deleted?: boolean;
  isActive?: boolean;
  isSuperUser?: boolean;
  groups: IGroupsDocumnet[];
  resetPassword?: { token: string; expires: Date } | {} ;
  refreshToken?: string;
  getAllPermissions(): IPermissionsDocument[];
  updateUser(): Query<IUserDocument[], IUserDocument, {}>;
}

export interface UserQueryModel {
  limit: number;
  offset: number;
  sortBy: string;
  sortOrder: SortOrder;
}

export interface IUserModel extends Model<IUserDocument> {
  addUser(user: IUserDocument): Promise<IUserDocument>;
  updateUser(user: any): Query<IUserDocument[], IUserDocument, {}>;
  changePassword(user: any): Query<IUserDocument[], IUserDocument, {}>;
  getAllUsers(
    query: UserQueryModel
  ): Query<IUserDocument[], IUserDocument, {}>;
  countUsers(query: UserQueryModel): Query<number, IUserDocument>;
  getUserById(
    _id: string
  ): Query<IUserDocument | null, IUserDocument, {}>;
  getUserByUsername(
    username: string
  ): Query<IUserDocument | null, IUserDocument, {}>;
  getUserByEmail(
    email: string
  ): Query<IUserDocument | null, IUserDocument, {}>;
  softDelete(
    _id: string
  ): Query<IUserDocument | null, IUserDocument, {}>;
  // findUserByAuth( body:any ): DocumentQuery<IUserDocument | null, IUserDocument, {}> ;
  addSession(
    body: any,
    token: string
  ): Query<IUserDocument | null, IUserDocument, {}>;
  logout(token: string): Query<IUserDocument | null, IUserDocument, {}>;
  generateResetPasswordToken(
    userName: string
  ): Query<IUserDocument[], IUserDocument, {}>;
  changePasswordByToken(
    token: string,
    newPassword: string
  ): Query<IUserDocument[], IUserDocument, {}>;
  getUserByToken(
    body: any
  ): Query<IUserDocument | null, IUserDocument, {}>;
  resetPasswordTokenExists(
    body: any
  ): Query<IUserDocument | null, IUserDocument, {}>;
  getUserRefreshToken(
    body: any
  ): Query<IUserDocument | null, IUserDocument, {}>;
}

export let UserSchema: Schema = new Schema(
  {
    email: { type: String, unique: true },
    username: { type: String, unique: true },
    password: String,
    displayName: String,
    type: String,
    deleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isSuperUser: { type: Boolean, default: false },
    resetPassword: { token: String, expires: Date },
    groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
    refreshToken: String
  },
  { timestamps: true, collation: { locale: 'en_US', strength: 2 } }
);

UserSchema.methods.getAllPermissions = function(): IPermissionsDocument[] {
  let permissions: IPermissionsDocument[] = [];
  (<IGroupsDocumnet[]> this.groups).forEach(group => {
    permissions.push(...group.permissions);
  });
  return permissions;
};

UserSchema.set('toJSON', {
  transform(doc: any, ret: any, opt: any) {
    delete ret.password;
    return ret;
  }
});

UserSchema.statics.updateUser = function(
  user: IUserDocument
): Query<IUserDocument | null, IUserDocument, {}>  {
  return (<IUserModel> this).findOneAndUpdate({ _id: user._id, deleted: false }, user,
    { new: false })
    .select('-refreshToken');
};

UserSchema.statics.addUser = function(user: any): Promise<IUserDocument> {
  return new UserModel(user).save();
};

UserSchema.statics.changePassword = function(
  user: any
): Query<UpdateWriteOpResult, IUserDocument, {}> {
  return (<IUserModel> this).updateOne(
    { _id: user._id, deleted: false },
    { password: user.newPassword, refreshToken: '' }
  );
};

UserSchema.statics.changePasswordByToken = function(
  token: string,
  newPassword: string
): Query<UpdateWriteOpResult, IUserDocument, {}> {
  console.log({ token, newPassword });
  return (<IUserModel> this).updateOne(
    {
      'resetPassword.token': token,
      'resetPassword.expires': { $gt: new Date() },
      deleted: false
    },
    { password: newPassword, refreshToken: '', resetPassword: {} }
  );
};

UserSchema.statics.generateResetPasswordToken = function(
  username: string
): Query<UpdateWriteOpResult, IUserDocument, {}> {
  const token = new ObjectId();
  const expiryDate = new Date(
    new Date().getTime() + Number(process.env.RESET_PASSWORD_EXP_TIME)
  );

  return (<IUserModel> this).updateOne(
    { username, deleted: false },
    { resetPassword: { token, expires: expiryDate } }
  );
};

UserSchema.statics.softDelete = function(
  _id: string
): Query<UpdateWriteOpResult, IUserDocument, {}> {
  return (<IUserModel> this).updateOne(
    { _id, deleted: false },
    { deleted: true }
  );
};

UserSchema.statics.getAllUsers = function(
  query: UserQueryModel
): Query<IUserDocument[], IUserDocument, {}> {
  return (<IUserModel> this)
    .find({ deleted: false })
    .select('-refreshToken')
    .skip(Number(query.offset))
    .limit(Number(query.limit))
    .sort({
      [query.sortBy]: query.sortOrder
    })
    .populate({ path: 'groups', match: { deleted: { $ne: true } } });
};

UserSchema.statics.countUsers = function(query: UserQueryModel): Query<number, IUserDocument> {
  return (<IUserModel> this).find({ deleted: false }).countDocuments();
};

UserSchema.statics.getUserById = function(
  _id: string
): Query<IUserDocument | null, IUserDocument, {}> {
  return (<IUserModel> this).findOne({ _id, deleted: false }).select('-refreshToken').populate({
    path: 'groups',
    match: { deleted: { $ne: true } },
    populate: { path: 'permissions' }
  });
};

UserSchema.statics.getUserByUsername = function(
  username: string
): Query<IUserDocument | null, IUserDocument, {}> {
  return (<IUserModel> this).findOne({ username, deleted: false }).populate({
    path: 'groups',
    match: { deleted: { $ne: true } },
    populate: { path: 'permissions' }
  });
};

UserSchema.statics.getUserByEmail = function(
  email: string
): Query<IUserDocument | null, IUserDocument, {}> {
  return (<IUserModel> this).findOne({ email, deleted: false }).populate({
    path: 'groups',
    match: { deleted: { $ne: true } },
    populate: { path: 'permissions' }
  });
};

/*
UserSchema.statics.findUserByAuth =  function( user : any): DocumentQuery<IUserDocument | null, IUserDocument, {}> {
  return  (<IUserModel>this).findOne({username: user.username , deleted: false} ) ;
};
 */

UserSchema.statics.addSession = function(
  user: any,
  token: string
): Query<IUserDocument | null, IUserDocument, {}> {

  return (<IUserModel> this).findOneAndUpdate(
    { _id: user._id, deleted: false },
    { refreshToken : token },
    { new: true }
  );
};

UserSchema.statics.logout = function(
  _id: string
): Query<UpdateWriteOpResult | null, IUserDocument, {}> {
  return (<IUserModel> this).updateOne(
    { _id },
    { refreshToken: ''  }
  );
};

UserSchema.statics.getUserByToken = function(
  token: string
): Query<IUserDocument | null, IUserDocument, {}> {
  return (<IUserModel> this)
    .findOne({
      refreshToken:token,
      deleted: false
    })
    .select('-refreshToken')
    .populate({ path: 'groups', populate: { path: 'permissions' } });
};


UserSchema.statics.resetPasswordTokenExists = function(
  token: string
): Query<IUserDocument | null, IUserDocument, {}> {
  return (<IUserModel> this)
    .findOne({
      'resetPassword.token': token,
      deleted: false
    });
};

UserSchema.statics.getUserRefreshToken = function(
  _id: string
): Query<IUserDocument | null, IUserDocument, {}> {
  return (<IUserModel> this)
    .findOne({
      _id ,
      deleted: false
    }, 'refreshToken -_id');
};


export const UserModel: IUserModel = model<IUserDocument, IUserModel>(
  'User',
  UserSchema
);
