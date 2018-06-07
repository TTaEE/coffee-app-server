var express = require('express');
var path = require('path');
var wait=require('wait.for');
var app = express();

var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var port = process.env.PORT || 3000;

var bodyParser = require('body-parser');

app.use(express.static(path.join(__dirname)));

// parse application/json
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

var mysql = require('mysql')

var conn = mysql.createConnection({
    host: '127.0.0.1',
    user: 'tae39850',
    password: '',
    database: 'coffeeshop'
});

server.listen(port, function () {
    console.log('[server] listening at port %d', port);
});

app.get('/getcoffee', function (req, res) {
  conn.query('SELECT * FROM product WHERE product_type = "coffee"', function(err, result) {
    res.send(result)
  })
})

app.get('/getdessert', function (req, res) {
  conn.query('SELECT * FROM product WHERE product_type = "dessert"', function(err, result) {
    res.send(result)
  })
})

function insertOrder(json) {
  var created = new Date();
  var in_order = wait.forMethod(conn,'query','INSERT INTO orders SET ?',{date : created})
  var in_id = in_order.insertId
  for (var i = 0; i < json.list.length; i++) {
    result = wait.forMethod(conn,'query','SELECT * FROM product where product_name = "'+json.list[i].name+'";')
    wait.forMethod(conn,'query','INSERT INTO orders_detail SET ?',{order_id : in_id, product_id : result[0].product_id, option_sugar : json.list[i].sugar, option_milk : json.list[i].milk})
  }
}

function getOrders() {
    var json = []
    order = wait.forMethod(conn,'query','SELECT * FROM orders where status != "paid"')
    console.log(order);
    for (var i = 0; i < order.length; i++) {
      list = wait.forMethod(conn,'query','SELECT product_name, product_price, option_sugar, option_milk FROM orders_detail AS t1 JOIN product AS t2 ON t1.product_id = t2.product_id WHERE t1.order_id = '+order[i].order_id)
      total = 0
      for (var j = 0; j < list.length; j++) {
        // console.log(list[i].product_price);
        total += list[j].product_price
      }
      json.push({"order_id":order[i].order_id,"date":order[i].date,"total_price":total,"status":order[i].status,"order_list":list})
    }
    console.log(json);
    io.emit('order-list',json)
}

function updateStatus(id) {
    console.log(id);
    order = wait.forMethod(conn,'query','SELECT * FROM orders WHERE order_id ='+id)
    // console.log(order[0].status);
    _status = order[0].status
    switch (_status) {
      case "waiting":
        _status = "making"
        break;
      case "making":
        _status = "success"
        break;
      case "success":
        _status = "paid"
        break;
    }
    // console.log(_status);
    wait.forMethod(conn,'query','UPDATE orders SET status = "'+_status+'" WHERE order_id  ='+id)
    wait.launchFiber(getOrders,null)
}

function DeleteOrder(id) {
    wait.forMethod(conn,'query','DELETE FROM orders WHERE order_id  ='+id)
    wait.forMethod(conn,'query','DELETE FROM orders_detail WHERE order_id  ='+id)
    wait.launchFiber(getOrders,null)
}
app.get('/delete', function (req,res) {
    var json = req.body.id
    wait.launchFiber(DeleteOrder,id)
})

app.post('/neworder', function (req, res) {
  var json = req.body.order
    wait.launchFiber(insertOrder,json)
    wait.launchFiber(getOrders,null)
    res.send({"status": true});
  })

app.post('/updatestatus', function (req, res) {
  var json = req.body.id
    wait.launchFiber(updateStatus,json)
    res.send('Update Completed!');
  })

io.on('connection', function (socket) {
    var json =[];
    wait.launchFiber(getOrders,null)
    // socket.on('order-list', function(message) {
    //   wait.launchFiber(getOrders,null)
    // })
    console.log('a client connected');
});

server.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0", function(){
  var addr = server.address();
  console.log("server listening at", addr.address + ":" + addr.port);
});
