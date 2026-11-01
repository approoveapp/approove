import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({organization:vi.fn(),share:vi.fn(),post:vi.fn(),read:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireActiveOrganization:mocks.organization}));
vi.mock("@/lib/share-access",()=>({validateShareToken:mocks.share}));
vi.mock("@/lib/prisma",()=>({prisma:{postItem:{findFirst:mocks.post}}}));
vi.mock("@/lib/media-storage",()=>({readDevMedia:mocks.read}));
vi.mock("@/lib/request-locale",()=>({getRequestLocale:async()=>"pt-BR"}));
import { GET } from "@/app/api/import-media/[organizationId]/[name]/route";
import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-error";
const params={params:Promise.resolve({organizationId:"org",name:"import-abc.png"})};
beforeEach(()=>{
 vi.clearAllMocks(); mocks.organization.mockResolvedValue({organization:{id:"org"}});
 mocks.share.mockResolvedValue({ok:true,access:{calendarVersionId:"calendar"}});
 mocks.post.mockResolvedValue({id:"post"});
 mocks.read.mockResolvedValue(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]));
});
describe("private media authorization",()=>{
 it("denies anonymous and foreign organizations before reading bytes",async()=>{
  mocks.organization.mockRejectedValue(new ApiError(401,"login"));
  expect((await GET(new NextRequest("http://localhost/api/import-media/org/import-abc.png"),params)).status).toBe(401);
  mocks.organization.mockResolvedValue({organization:{id:"other"}});
  expect((await GET(new NextRequest("http://localhost/api/import-media/org/import-abc.png"),params)).status).toBe(404);
  expect(mocks.read).not.toHaveBeenCalled();
 });
 it("serves admitted organization media without public caching or redirect",async()=>{
  const response=await GET(new NextRequest("http://localhost/api/import-media/org/import-abc.png"),params);
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("location")).toBeNull();
 });
 it("requires a valid share token and an asset attached to its own calendar",async()=>{
  const request=new NextRequest("http://localhost/api/import-media/org/import-abc.png?t=synthetic");
  mocks.share.mockResolvedValue({ok:false,status:401}); expect((await GET(request,params)).status).toBe(401);
  mocks.share.mockResolvedValue({ok:true,access:{calendarVersionId:"calendar"}});
  mocks.post.mockResolvedValue(null); expect((await GET(request,params)).status).toBe(404);
  expect(mocks.read).not.toHaveBeenCalled();
  mocks.post.mockResolvedValue({id:"post"});expect((await GET(request,params)).status).toBe(200);
  expect(mocks.post.mock.calls[0][0].where.calendarVersionId).toBe("calendar");
  expect(mocks.post.mock.calls[0][0].where.productionStage).toBe("ready_for_client");
 });
});

describe("bounded private media ranges", () => {
 it("serves video-compatible byte ranges only after authorization", async () => {
  const response = await GET(new NextRequest("http://localhost/api/import-media/org/import-abc.png", {headers: {range: "bytes=1-3"}}), params);
  expect(response.status).toBe(206);
  expect(response.headers.get("content-range")).toBe("bytes 1-3/12");
  expect(response.headers.get("content-length")).toBe("3");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([80,78,71]);
  mocks.read.mockClear(); mocks.organization.mockRejectedValue(new ApiError(401,"login"));
  expect((await GET(new NextRequest("http://localhost/api/import-media/org/import-abc.png", {headers:{range:"bytes=1-3"}}),params)).status).toBe(401);
  expect(mocks.read).not.toHaveBeenCalled();
 });
 it("handles suffixes and rejects invalid, multiple or out-of-bounds ranges", async () => {
  const request = (range: string) => new NextRequest("http://localhost/api/import-media/org/import-abc.png", {headers:{range}});
  expect((await GET(request("bytes=-2"),params)).headers.get("content-range")).toBe("bytes 10-11/12");
  for (const range of ["bytes=12-", "bytes=5-2", "bytes=-0", "bytes=-", "bytes=0-1,3-4", "bytes=9007199254740993-"]) {
   const response=await GET(request(range),params); expect(response.status).toBe(416); expect(response.headers.get("content-range")).toBe("bytes */12");
  }
 });
});
