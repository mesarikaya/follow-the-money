import { render } from "@testing-library/react";
import Home from "./page";

test("home page renders without crashing", () => {
  render(<Home />);
});
