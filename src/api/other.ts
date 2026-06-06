import request from "@/utils/request";

// 获取仓库更新日志
export const updateLog = () => {
  return request({
    baseURL: "https://api.github.com",
    withCredentials: false,
    url: "/repos/Lrht-llw/KfunMusic/releases",
    params: { noCookie: true },
  });
};
