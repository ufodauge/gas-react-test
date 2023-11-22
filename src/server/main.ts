import { sample as _sample, sample2 as _sample2 } from "./api/sample";
import { doGet as _doGet } from "./doGet";
import { apiHandler } from "./utils/result";

export const sample  = apiHandler(_sample);
export const sample2 = apiHandler(_sample2);

export const doGet   = () => _doGet();
