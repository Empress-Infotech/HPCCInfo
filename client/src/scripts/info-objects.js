function Plugin(id, label, category) {
	this.id = id;
	this.label = label;
	this.category = category;
}

function hostReachable(eclIP, hpccuser, password) {
	var promise = new Promise(function (resolve, reject) {
		$.ajax({
			url: "/clusterDetails/checkConnection",
			contentType: "application/json",
			type: 'POST',
			data: JSON.stringify({ "password": btoa(hpccuser + ":" + password), "url": eclIP }),
			success: function (data) {
				resolve(data);
			},
			error: function (request, status, error) {
				reject(error);
			}
		});
	});
	return promise;
}

function workunitStatus(url, queryparam, hpccuser, password) {
	var promise = new Promise(function (resolve, reject) {
		$.ajax({
			url: url + "/WsWorkunits/WUInfo.json?" + queryparam,
			headers: { 'Access-Control-Allow-Origin': '*' },
			dataType: "JSONP",
			jsonp: 'jsonp',
			type: 'GET',
			headers: {
				"Authorization": "Basic " + btoa(hpccuser + ":" + password)
			},
			success: function (data) {

				var wuState = data.WUInfoResponse.Workunit.State;

				if (wuState === "submitted" || wuState === 'compiling' || wuState === 'running' || wuState === 'compiled' || wuState === 'blocked') {
					workunitStatus(url, queryparam, hpccuser, password).then(function (data) {
						resolve(data);
					})
				} else if (wuState === 'completed') {
					resolve(data.WUInfoResponse.Workunit.Wuid);
					// return;
				} else {
					//var currentPage = document.querySelector("#pages").selectedItem;
					var currentPage = document.querySelector('my-app').shadowRoot.querySelector('hpcc-info-app').shadowRoot.querySelector('#infobox').shadowRoot.querySelector('#pages').selectedItem;
					var grid = currentPage.shadowRoot.querySelector(".projectworksheet");
					if (grid !== null) {
						var cols = grid.columns;
						for (; cols.length > 0;) {
							console.log(cols[0].name);
							grid.removeColumn(cols[0].name);
						}


						currentPage.loading = false;
						grid.items = [];
						grid.addColumn({ name: "<b>Something went wrong while fetching the data, Please try again or check you filter query again!</b>" });
					}
					reject('Something went wrong while fetching the data, Please try again or check you filter query again!');
				}

			}
		});
	});
	return promise;
}

function getFileListForSearch(url, pattern, hpccuser, password, nodegroup, contentType) {
	return $.ajax({
		//url : "http://10.240.33.54:8010/WsDfu/DFUQuery.json", 
		url: url + "/WsDfu/DFUQuery.json?LogicalName=" + pattern + '*' + '&ContentType=' + contentType,
		headers: { 'Access-Control-Allow-Origin': '*' },
		dataType: "JSONP",
		jsonp: 'jsonp',
		type: 'GET',
		async: 'false',
		error: function (data) { alert(''); },
		headers: {
			"Authorization": "Basic " + btoa(hpccuser + ":" + password)
		}
	});


}

function getThorList(url, hpccuser, password) {
	return $.ajax({
		//url : "http://10.240.33.54:8010/WsDfu/DFUQuery.json", 
		url: url + "/WsTopology/TpListTargetClusters.json",
		headers: { 'Access-Control-Allow-Origin': '*' },
		dataType: "JSONP",
		jsonp: 'jsonp',
		type: 'GET',
		async: 'false',
		headers: {
			"Authorization": "Basic " + btoa(hpccuser + ":" + password)
		}
	});
}

function loadGridwithEcl(QueryStr, recLimit) {

	var infoBox = document.querySelector('my-app').shadowRoot.querySelector('hpcc-info-app').shadowRoot.querySelector('#infobox');
	var currentPage = infoBox.shadowRoot.querySelector('#pages').selectedItem;

	//Set paper-progress when the grid is being loaded
	currentPage.loading = true;

	var eclIP = (infoBox.isHpccSecured === "true" ? "https://" : "http://") +
		// (infoBox.properties.username != '' ? infoBox.properties.username + ':' + infoBox.properties.password + '@' : '') +
		infoBox.cluster_address +
		":" + infoBox.port;

	var getFileData = new Promise(function (resolve, reject) {
		callAjaxForECL(eclIP, QueryStr, infoBox.username, infoBox.password, recLimit).then(function (resData) {
			resolve(resData);
		});
	});

	getFileData.then(function (ajaxResp) {

		var currentPage = infoBox.shadowRoot.querySelector('#pages').selectedItem;
		var grid;
		if (currentPage.shadowRoot.querySelector(".projectworksheet") != null) {
			grid = currentPage.shadowRoot.querySelector(".projectworksheet");
			grid.innerHTML="";
			if (ajaxResp.Result.Row.length == 0) {
				var headerTemplate = document.createElement('template');
				headerTemplate.classList.add('header');
				headerTemplate.innerHTML = "";
				var bodyTemplate = document.createElement('template');
				bodyTemplate.innerHTML = "<b>There are no records for your Filter Query</b>";
				var column = document.createElement('vaadin-grid-column');
				column.appendChild(headerTemplate);
				column.appendChild(bodyTemplate);
				grid.appendChild(column);
				currentPage.loading = false;
				return;
			}
			var obj = ajaxResp.Result.Row[0];
			var cnt = 0;
			var colArray = [];
			var fieldnames = "";

			Object.keys(obj).forEach(function (key) {
				//grid.addColumn({ name: key, resizable: true });
				if (fieldnames === "") {
					fieldnames += key;
				} else {
					fieldnames += "," + key;
				}
				colArray[cnt] = key;
				cnt++;
			});
			for (var i = 0; i < cnt; i++) {

				var headerTemplate = document.createElement('template');
				headerTemplate.classList.add('header');
				headerTemplate.innerHTML = colArray[i];

				var body = "[[item." + colArray[i] + "]]";
				var bodyTemplate = document.createElement('template');
				bodyTemplate.innerHTML = body;
				var column = document.createElement('vaadin-grid-column');
				column.appendChild(headerTemplate);
				column.appendChild(bodyTemplate);
				grid.appendChild(column);
			}
			grid.items = ajaxResp.Result.Row;

			currentPage.editor.displayFields = fieldnames;

			sessionStorage.setItem('gridColumns', colArray);
			// Add some example data as an array.
			currentPage.loading = false;
		}
		else {
			currentPage.loading = false;
			initchart(ajaxResp.Result.Row, currentPage.selectedchartyype, currentPage.selectedxcoordinate, currentPage.selectedycoordinate);
		}
	});



	return;
}

function callAjaxForECL(url, eclCode, hpccuser, password, recLimit) {
	var wuid = '';
	//var infoBox = document.querySelector('#infobox')
	var infoBox = document.querySelector('my-app').shadowRoot.querySelector('hpcc-info-app').shadowRoot.querySelector('#infobox');
	var clusterid = infoBox.clusterid === '' || infoBox.clusterid === undefined || infoBox.clusterid === 'undefined' ? 'hthor' : infoBox.clusterid;
	var promise = new Promise(
		function (resolve, reject) {

			$.ajax({
				url: url + "/WsWorkunits/WUCreateAndUpdate.json",
				data: { "QueryText": eclCode.replace(/\n/g, ''), "ResultLimit": recLimit, "Jobname": "HPCCInfoRequest" },
				headers: { 'Access-Control-Allow-Origin': '*' },
				dataType: "JSONP",
				jsonp: 'jsonp',
				type: "POST",
				crossDomain: true,
				headers: {
					"Authorization": "Basic " + btoa(hpccuser + ":" + password)
				},
				success: function (data) {
					wuid = data.WUUpdateResponse.Workunit.Wuid;
					$.ajax({
						url: url + "/WsWorkunits/WUSubmit.json?Wuid=" + data.WUUpdateResponse.Workunit.Wuid + '&Cluster=' + clusterid,
						headers: { 'Access-Control-Allow-Origin': '*' },
						dataType: "JSONP",
						jsonp: 'jsonp',
						type: 'GET',
						headers: {
							"Authorization": "Basic " + btoa(hpccuser + ":" + password)
						},
						success: function (data) {
							var wustatus = new Promise(function (res, rej) {
								workunitStatus(url, "Wuid=" + wuid + "&Cluster=" + clusterid, hpccuser, password).then(function (data) {
									res(data);
								})
							});

							wustatus.then(function (result) {
								$.ajax({
									url: url + "/WsWorkunits/WUResult.json?Wuid=" + result + '&Cluster=' + clusterid + '&Count=' + recLimit,
									headers: { 'Access-Control-Allow-Origin': '*' },
									dataType: "JSONP",
									jsonp: 'jsonp',
									type: 'GET',
									headers: {
										"Authorization": "Basic " + btoa(hpccuser + ":" + password)
									},
									success: function (data) {

										if (data.WUResultResponse.Name === "SUPERFILECONTENTS") {
											var newData = callForFileDetails(url, data.WUResultResponse.Result.Row[0].super, data.WUResultResponse.Result.Row[0].name, hpccuser, password);
											newData.then(
												function (val) {
													resolve(val);
												}
											);
										} else {
											resolve(data.WUResultResponse);
										}

									}
								});
							});
						}
					});
				}
			});
		}
	);

	return promise;
}
function callForFileDetails(url, filename, subfilename, hpccuser, password, recLimit) {
	//var infoBox = document.querySelector('#infobox');
	var infoBox = document.querySelector('my-app').shadowRoot.querySelector('hpcc-info-app').shadowRoot.querySelector('#infobox');
	var promise = new Promise(function (resolve, reject) {
		var wuid = '';
		$.ajax({
			url: url + "/WsDfu/DFUInfo.json?Name=" + (subfilename.startsWith('~') === false ? '~' : '') + subfilename,
			headers: { 'Access-Control-Allow-Origin': '*' },
			dataType: "JSONP",
			jsonp: 'jsonp',
			type: 'GET',
			headers: {
				"Authorization": "Basic " + btoa(hpccuser + ":" + password)
			},
			success: function (data) {
				console.log(data.DFUInfoResponse);

				//var currentPage = document.querySelector("#pages").selectedItem;
				var currentPage = document.querySelector('my-app').shadowRoot.querySelector('hpcc-info-app').shadowRoot.querySelector('#infobox').shadowRoot.querySelector('#pages').selectedItem;
				outputdsname = 'inputds' + '_' + Math.random().toString(36).substr(2, 4);

				if (data.DFUInfoResponse.FileDetail.isSuperfile) {
					var QueryStr = "IMPORT STD;NOTHOR(OUTPUT(DATASET([{NOTHOR(std.file.SUPERFILECONTENTS('~" + filename + "', TRUE)[1].NAME), '~" + filename + "'}], {STRING NAME, STRING SUPER}), NAMED('SUPERFILECONTENTS')));";

					// OUTPUT(STD.FILE.SUPERFILECONTENTS('~" + filename + "', TRUE)[1], NAMED('SUPERFILECONTENTS'));"
				} else {
					var QueryStr1 = "#OPTION(\'OUTPUTLIMIT\',2000);\nrecLayout := " + data.DFUInfoResponse.FileDetail.Ecl + "\n" +
						outputdsname + " := DATASET(\'" + (filename.startsWith('~') ? '' : '~') + filename + "\'," + "recLayout, THOR);\n";

					var recLayout = data.DFUInfoResponse.FileDetail.Ecl.replace("RECORD", "");

					str = recLayout.replace("[{}]", "").replace(",", ";").trim();

					// HashMap<String, String> fielddts = new HashMap<String, String>();
					var fields = str.split(";");

					var fielddts = new Map();

					var recordStartEnd = ["RECORD", "END"];

					for (var cnt = 0; cnt < fields.length; cnt++) {
						var singlePart = fields[cnt].trim();
						if (!recordStartEnd.includes(singlePart.trim())) {
							var twoParts = (singlePart.endsWith(";") ? singlePart.substring(0, singlePart.length() - 1) : singlePart).trim().split(" ");
							fielddts.set(twoParts[1], twoParts[0]);
						}
					}

					infoBox.fieldDtls = fielddts;

					var strFields = ["STRING", "UNICODE"];

					console.log("Field====>Type ======> IsStringType\n===============================================\n\n");

					// for(Map.Entry<String, String> maps : fielddts.entrySet()){
					// 	System.out.println(maps.getKey() + "===>" + maps.getValue() + "==>" + 
					// 			strtypes.includes(maps.getValue().toUpperCase().replace("[^a-zA-Z]", "")));
					// }


					for (var i in fielddts) {
						console.log('Key is: ' + i + '. Value is: ' + fielddts[i]);
					}
					var QueryStr = QueryStr1 + "Output(" + outputdsname + ");";
				}
				console.log(QueryStr);
				var callAjaxPromise = new Promise(function (rs, rj) {
					callAjaxForECL(url, QueryStr, hpccuser, password, recLimit).then(function (data) {
						rs(data);
					})
				});

				callAjaxPromise.then(function (data) {
					data.outputdsname = outputdsname;
					data.querystr = QueryStr1 != undefined ? QueryStr1 : data.querystr;
					resolve(data);
				});

			}
		});
	});
	return promise;
}
function initchart(griditems, charttype, xcoordinate, ycoordinate) {
	var charttype = charttype;
	var xcoordinatefield = xcoordinate;
	var ycoordinatefield = ycoordinate;
	var infoBox = document.querySelector('my-app').shadowRoot.querySelector('hpcc-info-app').shadowRoot.querySelector('#infobox');
	var currentPage = infoBox.shadowRoot.querySelector('#pages').selectedItem;
	var salesdata = [];
	legendarray = [];
	var yAxisarray = [];
	var myArray = griditems;
	var subtotal;
	var groups = {};
	for (var i = 0; i < griditems.length; i++) {
		var rows = griditems[i];
		var groupName = rows[xcoordinatefield];
		if (!groups[groupName]) {
			groups[groupName] = [];
		}
		groups[groupName].push(rows[ycoordinatefield]);

	}
	myArray = [];

	for (var groupName in groups) {
		var yaxisdata = groups[groupName];
		var yaxistotal = 0;
		for (var j = 0; j < yaxisdata.length; j++) {
			yaxistotal = +yaxistotal + +yaxisdata[j];
		}
		myArray.push({ "name": groupName, "value": yaxistotal });
		legendarray.push(groupName);
	}

	this.myChart = echarts.init(currentPage.shadowRoot.querySelector("#divChart"));

	//For echarts styling   http://echarts.baidu.com/echarts2/doc/example/bar.html
	// specify chart configuration item and data
	if (charttype == 'pie') {
		// option for pie chart
		var option = {
			title: {
				text: 'HPCC INFO SALES DATA',
				subtext: xcoordinatefield + " - " + ycoordinatefield + " Chart",
				x: 'center'
			},
			tooltip: {
				trigger: 'item',
				formatter: "{a} <br/>{b} : {c} ({d}%)"
			},
			legend: {
				orient: 'vertical',
				x: 'left',
				data: legendarray
			},
			xAxis: { show: false },
			yAxis: { show: false },
			toolbox: {
				show: true,
				feature: {
					magicType: {
						show: false						
					},
					restore: {
						show: false,
						title: 'Restore'
					},
					saveAsImage: {
						show: true,
						title: 'Save'
					}
				}
			},
			calculable: true,
			series: [
				{
					name: 'Sales',
					type: charttype,
					radius: '55%',
					center: ['50%', '60%'],
					data: myArray
				}
			]
		};
	}
	else if (charttype == 'bar' || charttype == 'line') {
		// option for bar chart
		var option = {
			title: {
				text: 'HPCC INFO SALES DATA',
				subtext: xcoordinatefield + " - " + ycoordinatefield + " Chart",
				x: 'center'
			},
			tooltip: {
				trigger: 'item',
				formatter: "{a} <br/>{b} : {c}"
			},
			legend: {
				orient: 'vertical',
				x: 'left',
				data: ['Sales']
			},
			xAxis: {
				show: true,
				type: 'category',
				axisTick: {
					show: true,
					interval: 0
					//alignWithLabel: true
				},
				axisLabel: {
					show: true,
					interval: 0
				},
				data: legendarray
			},
			yAxis: {
				show: true,
				type: 'value'
			},
			toolbox: {
				show: true,
				feature: {
					magicType: {
						show: true,
						type: ['line', 'bar'],
						title: {
							line: 'line',
							bar: 'bar'
						}
					},
					restore: {
						show: true,
						title: 'Restore'
					},
					saveAsImage: {
						show: true,
						title: 'Save'
					}
				}
			},
			calculable: true,
			series: [{
				name: 'Sales',
				itemStyle: {
					normal: {
						barBorderColor: 'tomato',
						color: 'gray'
					},
					emphasis: {
						barBorderColor: 'red',
						color: 'brown'
					}
				},
				type: charttype,
				data: myArray
			}]
		};
	}
	// use configuration item and data specified to show chart
	this.myChart.setOption(option);
}