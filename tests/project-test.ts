import { ProjectModel } from "../source/models/projects-model"
import DBConnection from '../source/db';
import {expect} from 'chai';
import {EventEmitter} from 'events';
import {waitFor} from 'wait-for-event';

describe('project', function() {
  it('add', async function() {
    const dbConn = new DBConnection();
    const emitter = new EventEmitter();
    dbConn.connection.once('open', async () => {
      console.log('unittest DB Connected');
      emitter.emit('done')
    });
    await waitFor('done', emitter);
    // create one
    const newPrj = new ProjectModel({
      name: "testProject",
      description: "this is from unit test",
      company: "ai-double",
      domain: "tasknote.ai",
      displayName: "Test Project",
      payload: {
        "extension1": 1,
        "country": "cn"
      }
    });
    await newPrj.save();

    //query it
    const getPrj = await ProjectModel.findOne({name: "testProject"});
    console.log("query result:", getPrj?.payload);
    expect(getPrj?.company).equal("ai-double");
    try {
      await newPrj.save();
      expect(false).equal(true);
    }
    catch(e) {
    }
    //delete it
    await ProjectModel.deleteById(getPrj?.id);

    dbConn.db.disconnect();
  });

  it("second", function() {
    console.log("second")
  });
});
