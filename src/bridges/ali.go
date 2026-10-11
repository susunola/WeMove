package main

import (
	"encoding/json"
	"fmt"
	"github.com/tickstep/aliyunpan-api/aliyunpan"
	"github.com/tickstep/aliyunpan/internal/command"
	"github.com/tickstep/aliyunpan/internal/config"
	"os"
	"path"
	"strings"
)

func fail(e interface{}) {
	json.NewEncoder(os.Stdout).Encode(map[string]interface{}{"error": fmt.Sprint(e)})
	os.Exit(1)
}
func item(f *aliyunpan.FileEntity) map[string]interface{} {
	return map[string]interface{}{"id": f.FileId, "name": f.FileName, "path": f.Path, "isDir": f.IsFolder(), "size": f.FileSize, "modified": f.UpdatedAt, "hash": f.ContentHash, "hashType": f.ContentHashName}
}
func main() {
	if len(os.Args) < 3 {
		fail("usage: ali-bridge list|stat PATH [DRIVE]")
	}
	if e := config.Config.Init(); e != nil {
		fail(e)
	}
	var u *config.PanUser
	for _, candidate := range config.Config.UserList {
		if candidate.UserId == config.Config.ActiveUID {
			u = candidate
			break
		}
	}
	if u == nil {
		fail("请先连接阿里云盘")
	}
	restored, e := config.SetupUserByCookie(u.OpenapiToken, u.WebapiToken, u.TicketId, u.UserId, config.Config.DeviceId, config.Config.DeviceName, config.Config.ClientId, config.Config.ClientSecret)
	if e != nil {
		fail(e)
	}
	u.OpenapiToken = restored.OpenapiToken
	u.WebapiToken = restored.WebapiToken
	u.UpdateClient(restored.PanClient().OpenapiPanClient(), restored.PanClient().WebapiPanClient())
	if e := config.Config.Save(); e != nil {
		fail(e)
	}
	if e := command.RefreshOpenTokenInNeed(u); e != nil && !strings.Contains(strings.ToLower(e.Msg), "not need to refresh") {
		fail(e.Msg)
	}
	if e := config.Config.Save(); e != nil {
		fail(e)
	}
	drive := u.ActiveDriveId
	if len(os.Args) > 3 && os.Args[3] != "" {
		drive = os.Args[3]
	}
	defer config.Config.Save()
	client := u.PanClient().OpenapiPanClient()
	f, e := client.FileInfoByPath(drive, os.Args[2])
	if e != nil {
		fail(e)
	}
	f.Path = os.Args[2]
	switch os.Args[1] {
	case "stat":
		json.NewEncoder(os.Stdout).Encode(map[string]interface{}{"item": item(f)})
	case "list":
		if !f.IsFolder() {
			fail("不是目录")
		}
		files, e := client.FileListGetAll(&aliyunpan.FileListParam{DriveId: drive, ParentFileId: f.FileId}, 200)
		if e != nil {
			fail(e)
		}
		out := []map[string]interface{}{}
		for _, v := range files {
			v.Path = path.Join(os.Args[2], v.FileName)
			out = append(out, item(v))
		}
		json.NewEncoder(os.Stdout).Encode(map[string]interface{}{"items": out, "drives": u.DriveList, "drive": drive})
	default:
		fail("unsupported operation")
	}
}
