import { GASClient } from "gas-client";
import * as server from "../server/main";
const { serverFunctions } = new GASClient<typeof server>();

function App() {
  const param = "apple";

  serverFunctions.sample(param).then((v) => {
    console.log(v);
  });

  serverFunctions.sample2(1, "2", [false, 4]).then((v) => {
    console.log(v);
  });

  return <></>;
}

export default App;
