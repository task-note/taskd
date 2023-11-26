import {
  Document,
  Schema,
  Model,
  model,
  Query,
  Mixed
} from 'mongoose';

export interface IProjectDocument extends Document {
  name: string;
  description: string;
  company: string;
  domain: string;
  displayName?: string;
  deleted?: boolean;
  isActive?: boolean;
  payload?: Mixed;
}

export interface IProjectModel extends Model<IProjectDocument> {
  addProject(project: IProjectDocument): Promise<IProjectDocument>;
  updateProject(project: any): Query<IProjectDocument[], IProjectDocument, {}>;
  deleteById(id: String): any; 
}

export let ProjectSchema: Schema = new Schema(
  {
    name: { type: String, unique: true, dropDups: true },
    description: String,
    company: String,
    domain: String,
    displayName: String,
    deleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    payload: {type: Schema.Types.Mixed, required: false}
  },
  { timestamps: true, collation: { locale: 'en_US', strength: 2 } }
);


ProjectSchema.statics.updateProject = function(
  project: IProjectDocument
): Query<IProjectDocument | null, IProjectDocument, {}>  {
  return (<IProjectModel> this).findOneAndUpdate({ _id: project._id, deleted: false }, project,
    { new: false });
};

ProjectSchema.statics.addProject = function(project: any): Promise<IProjectDocument> {
  return new ProjectModel(project).save();
};

ProjectSchema.statics.deleteById = function(id :String) {
  return this.deleteOne({ _id: id })
};

export const ProjectModel: IProjectModel = model<IProjectDocument, IProjectModel>(
  'Project',
  ProjectSchema
);
